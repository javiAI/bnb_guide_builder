// Core contract for `messaging-automation.service.ts`:
//  - Idempotency (same reservation × automation → one draft row).
//  - Timezone-correct `scheduledSendAt` (anchor + offset under property tz).
//  - Cancel cascade (pending_review/approved → cancelled on reservation cancel).

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    reservation: {
      findUnique: vi.fn(),
    },
    property: {
      findUnique: vi.fn(),
    },
    messageAutomation: {
      findMany: vi.fn(),
    },
    messageDraft: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

// Skip real resolution for these tests — assume body passes through unchanged.
vi.mock("@/lib/services/messaging-variables.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/messaging-variables.service")
  >("@/lib/services/messaging-variables.service");
  return {
    ...actual,
    resolveVariables: vi.fn(async (_propertyId: string, body: string) => ({
      output: body,
      states: {},
      resolved: [],
      missing: [],
      unknown: [],
      unresolvedContext: [],
    })),
  };
});

import {
  cancelDraftsForReservation,
  computeScheduledSendAt,
  materializeDraftsForReservation,
} from "@/lib/services/messaging-automation.service";
import { findMessagingTrigger } from "@/lib/taxonomy-loader";

const FIXTURE_RESERVATION = {
  id: "r_1",
  propertyId: "p_1",
  status: "confirmed",
  guestName: "Ana García",
  checkInDate: new Date("2026-05-10T00:00:00Z"),
  checkOutDate: new Date("2026-05-13T00:00:00Z"),
  numGuests: 2,
  locale: "es",
  createdAt: new Date("2026-04-01T10:00:00Z"),
};

const FIXTURE_PROPERTY = {
  id: "p_1",
  timezone: "Europe/Madrid",
  checkInStart: "16:00",
  checkOutTime: "11:00",
};

const FIXTURE_TEMPLATE = {
  id: "tpl_1",
  bodyMd: "Hola {{guest_name}}, bienvenida.",
};

const FIXTURE_AUTOMATION = {
  id: "auto_1",
  templateId: "tpl_1",
  channelKey: "whatsapp",
  triggerType: "before_arrival",
  sendOffsetMinutes: -1440, // 24h before
  touchpointKey: "pre_arrival",
  template: FIXTURE_TEMPLATE,
};

function resetMocks() {
  for (const model of Object.values(prismaMock)) {
    for (const fn of Object.values(model)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
}

describe("computeScheduledSendAt", () => {
  it("anchors to checkIn + offset in property timezone", () => {
    const trigger = findMessagingTrigger("before_arrival")!;
    const sendAt = computeScheduledSendAt({
      trigger,
      reservation: FIXTURE_RESERVATION,
      property: FIXTURE_PROPERTY,
      offsetMinutes: -1440,
    });
    expect(sendAt).not.toBeNull();
    // Check-in on 2026-05-10 at 16:00 Europe/Madrid (UTC+2 DST) = 14:00 UTC.
    // Minus 24h = 2026-05-09T14:00:00Z.
    expect(sendAt!.toISOString()).toBe("2026-05-09T14:00:00.000Z");
  });

  it("anchors to checkOut for after_checkout triggers", () => {
    const trigger = findMessagingTrigger("after_checkout")!;
    const sendAt = computeScheduledSendAt({
      trigger,
      reservation: FIXTURE_RESERVATION,
      property: FIXTURE_PROPERTY,
      offsetMinutes: 60, // +1h after check-out
    });
    expect(sendAt).not.toBeNull();
    // Check-out 2026-05-13 at 11:00 Europe/Madrid (UTC+2) = 09:00 UTC. +1h = 10:00 UTC.
    expect(sendAt!.toISOString()).toBe("2026-05-13T10:00:00.000Z");
  });

  it("anchors to reservation.createdAt for bookingConfirmed", () => {
    const trigger = findMessagingTrigger("on_booking_confirmed")!;
    const sendAt = computeScheduledSendAt({
      trigger,
      reservation: FIXTURE_RESERVATION,
      property: FIXTURE_PROPERTY,
      offsetMinutes: 5,
    });
    expect(sendAt).not.toBeNull();
    // createdAt + 5 min
    expect(sendAt!.toISOString()).toBe("2026-04-01T10:05:00.000Z");
  });

  it("shifts with DST transitions correctly (winter vs summer)", () => {
    const trigger = findMessagingTrigger("before_arrival")!;
    // Winter reservation (CET = UTC+1)
    const winterSend = computeScheduledSendAt({
      trigger,
      reservation: {
        ...FIXTURE_RESERVATION,
        checkInDate: new Date("2026-01-15T00:00:00Z"),
      },
      property: FIXTURE_PROPERTY,
      offsetMinutes: -60, // 1h before
    });
    // Check-in 2026-01-15 at 16:00 Europe/Madrid (UTC+1) = 15:00 UTC. -1h = 14:00 UTC.
    expect(winterSend!.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });
});

describe("materializeDraftsForReservation — idempotency", () => {
  beforeEach(() => {
    resetMocks();
    prismaMock.reservation.findUnique.mockResolvedValue(FIXTURE_RESERVATION);
    prismaMock.property.findUnique.mockResolvedValue(FIXTURE_PROPERTY);
    prismaMock.messageAutomation.findMany.mockResolvedValue([FIXTURE_AUTOMATION]);
  });

  it("creates a draft the first time", async () => {
    prismaMock.messageDraft.findUnique.mockResolvedValue(null);
    prismaMock.messageDraft.create.mockResolvedValue({ id: "draft_1" });

    const outcomes = await materializeDraftsForReservation("r_1");

    expect(outcomes).toEqual([
      { automationId: "auto_1", reservationId: "r_1", draftId: "draft_1", outcome: "created" },
    ]);
    expect(prismaMock.messageDraft.create).toHaveBeenCalledOnce();
    expect(prismaMock.messageDraft.update).not.toHaveBeenCalled();
  });

  it("second call with identical inputs is a no-op (unchanged)", async () => {
    prismaMock.messageDraft.findUnique.mockResolvedValue({
      id: "draft_1",
      status: "pending_review",
      scheduledSendAt: new Date("2026-05-09T14:00:00.000Z"),
      bodyMd: "Hola {{guest_name}}, bienvenida.",
      lifecycleHistoryJson: [],
    });

    const outcomes = await materializeDraftsForReservation("r_1");

    expect(outcomes[0].outcome).toBe("unchanged");
    expect(prismaMock.messageDraft.create).not.toHaveBeenCalled();
    expect(prismaMock.messageDraft.update).not.toHaveBeenCalled();
  });

  it("updates a pending_review draft when schedule changes", async () => {
    prismaMock.messageDraft.findUnique.mockResolvedValue({
      id: "draft_1",
      status: "pending_review",
      scheduledSendAt: new Date("2025-01-01T00:00:00.000Z"), // stale
      bodyMd: "Hola {{guest_name}}, bienvenida.",
      lifecycleHistoryJson: [],
    });

    const outcomes = await materializeDraftsForReservation("r_1");

    expect(outcomes[0].outcome).toBe("updated");
    expect(prismaMock.messageDraft.update).toHaveBeenCalledOnce();
  });

  it("leaves approved drafts untouched even if inputs drift", async () => {
    prismaMock.messageDraft.findUnique.mockResolvedValue({
      id: "draft_1",
      status: "approved",
      scheduledSendAt: new Date("2025-01-01T00:00:00.000Z"),
      bodyMd: "diff body",
      lifecycleHistoryJson: [],
    });

    const outcomes = await materializeDraftsForReservation("r_1");

    expect(outcomes[0].outcome).toBe("unchanged");
    expect(prismaMock.messageDraft.update).not.toHaveBeenCalled();
  });
});

describe("cancelDraftsForReservation", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("transitions pending_review + approved to cancelled, leaves sent", async () => {
    prismaMock.messageDraft.findMany.mockResolvedValue([
      { id: "d_pending", status: "pending_review", lifecycleHistoryJson: [] },
      { id: "d_approved", status: "approved", lifecycleHistoryJson: [] },
    ]);
    prismaMock.messageDraft.updateMany.mockResolvedValue({ count: 1 });

    const count = await cancelDraftsForReservation("r_1");
    expect(count).toBe(2);
    expect(prismaMock.messageDraft.updateMany).toHaveBeenCalledTimes(2);
    // The findMany where clause must filter to non-terminal statuses.
    const findCall = prismaMock.messageDraft.findMany.mock.calls[0][0] as {
      where: { status: { in: string[] } };
    };
    expect(findCall.where.status.in).toEqual(["pending_review", "approved"]);
    // Every updateMany must carry the same status guard so a draft that
    // transitioned to a terminal status between read and write is skipped.
    for (const [args] of prismaMock.messageDraft.updateMany.mock.calls) {
      const guarded = args as {
        where: { id: string; status: { in: string[] } };
      };
      expect(guarded.where.status.in).toEqual(["pending_review", "approved"]);
    }
  });

  it("skips drafts that transitioned to a terminal status between read and write", async () => {
    // Read returns two drafts; before we write, one of them is raced to `sent`
    // by another process. Prisma's `updateMany` respects the status guard and
    // returns count:0 for that row — we must not count it as cancelled.
    prismaMock.messageDraft.findMany.mockResolvedValue([
      { id: "d_pending", status: "pending_review", lifecycleHistoryJson: [] },
      { id: "d_raced_to_sent", status: "approved", lifecycleHistoryJson: [] },
    ]);
    prismaMock.messageDraft.updateMany
      .mockResolvedValueOnce({ count: 1 }) // d_pending still eligible
      .mockResolvedValueOnce({ count: 0 }); // d_raced_to_sent no longer matches guard

    const count = await cancelDraftsForReservation("r_1");

    expect(count).toBe(1); // only the one that actually transitioned
    expect(prismaMock.messageDraft.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.messageDraft.update).not.toHaveBeenCalled();
  });

  it("returns zero when every draft was raced to a terminal status", async () => {
    prismaMock.messageDraft.findMany.mockResolvedValue([
      { id: "d1", status: "pending_review", lifecycleHistoryJson: [] },
      { id: "d2", status: "approved", lifecycleHistoryJson: [] },
    ]);
    prismaMock.messageDraft.updateMany.mockResolvedValue({ count: 0 });

    const count = await cancelDraftsForReservation("r_1");

    expect(count).toBe(0);
    expect(prismaMock.messageDraft.update).not.toHaveBeenCalled();
  });

  it("cancels all drafts on reservation cancel (materializer path)", async () => {
    prismaMock.reservation.findUnique.mockResolvedValue({
      ...FIXTURE_RESERVATION,
      status: "cancelled",
    });
    prismaMock.messageDraft.findMany.mockResolvedValue([
      { id: "d1", status: "pending_review", lifecycleHistoryJson: [] },
    ]);
    prismaMock.messageDraft.updateMany.mockResolvedValue({ count: 1 });

    const outcomes = await materializeDraftsForReservation("r_1");
    expect(outcomes[0].outcome).toBe("blocked_reservation_cancelled");
    expect(prismaMock.messageDraft.updateMany).toHaveBeenCalledOnce();
  });
});

describe("materializeDraftsForReservation — P2002 race", () => {
  // Two concurrent ticks/retries can both see `findUnique → null` and both
  // attempt `create`. The unique constraint `@@unique([automationId, reservationId])`
  // makes the second create throw P2002. The materializer must swallow that
  // violation, re-read the row created by the winner, and return `unchanged`
  // so the operation remains truly idempotent.
  beforeEach(() => {
    resetMocks();
    prismaMock.reservation.findUnique.mockResolvedValue(FIXTURE_RESERVATION);
    prismaMock.property.findUnique.mockResolvedValue(FIXTURE_PROPERTY);
    prismaMock.messageAutomation.findMany.mockResolvedValue([FIXTURE_AUTOMATION]);
  });

  it("returns `unchanged` when `create` races against another tick (P2002)", async () => {
    // Simulate the race: our findUnique sees no existing draft, but by the
    // time we call create, another tick has already inserted the row.
    prismaMock.messageDraft.findUnique
      .mockResolvedValueOnce(null) // pre-create check (our turn, no row)
      .mockResolvedValueOnce({ id: "draft_winner" }); // post-P2002 re-read
    const p2002 = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    prismaMock.messageDraft.create.mockRejectedValueOnce(p2002);

    const outcomes = await materializeDraftsForReservation("r_1");

    expect(outcomes).toEqual([
      {
        automationId: "auto_1",
        reservationId: "r_1",
        draftId: "draft_winner",
        outcome: "unchanged",
      },
    ]);
    expect(prismaMock.messageDraft.create).toHaveBeenCalledOnce();
    expect(prismaMock.messageDraft.update).not.toHaveBeenCalled();
  });

  it("propagates non-P2002 errors from `create`", async () => {
    prismaMock.messageDraft.findUnique.mockResolvedValueOnce(null);
    prismaMock.messageDraft.create.mockRejectedValueOnce(
      new Error("connection reset"),
    );

    await expect(materializeDraftsForReservation("r_1")).rejects.toThrow(
      "connection reset",
    );
  });
});
