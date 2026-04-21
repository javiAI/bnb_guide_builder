// Safety gates for 12B:
//  - `internal_only` tokens block automation creation at check-time (pure helper).
//  - `sensitive_prearrival` blocks runtime materialization when scheduledSendAt
//    is at or after the check-in instant.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    reservation: { findUnique: vi.fn() },
    property: { findUnique: vi.fn() },
    messageAutomation: { findMany: vi.fn() },
    messageDraft: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

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
  SENSITIVE_PREARRIVAL_MAX_LEAD_HOURS,
  bodyUsesInternalOnly,
  bodyUsesSensitivePrearrival,
  materializeDraftsForReservation,
} from "@/lib/services/messaging-automation.service";
import { messagingVariables } from "@/lib/taxonomy-loader";

function resetMocks() {
  for (const model of Object.values(prismaMock)) {
    for (const fn of Object.values(model)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
}

describe("bodyUsesInternalOnly (check-time guard)", () => {
  it("returns false for a body with only safe_always vars", () => {
    expect(bodyUsesInternalOnly("Hola {{guest_name}} en {{property_name}}")).toBe(false);
  });

  it("returns true if any token has sendPolicy internal_only", () => {
    // Find an internal_only token from the taxonomy; if none exists (e.g.
    // the current catalog has none), skip the assertion with a guard.
    const internalVar = messagingVariables.items.find(
      (v) => v.sendPolicy === "internal_only",
    );
    if (!internalVar) {
      expect(bodyUsesInternalOnly("Hola {{no_such_var}}")).toBe(false);
      return;
    }
    expect(
      bodyUsesInternalOnly(`Nota interna: {{${internalVar.variable}}}`),
    ).toBe(true);
  });
});

describe("bodyUsesSensitivePrearrival (runtime guard)", () => {
  it("returns true for bodies that reference an access/wifi sensitive var", () => {
    const sensitiveVar = messagingVariables.items.find(
      (v) => v.sendPolicy === "sensitive_prearrival",
    );
    expect(sensitiveVar).toBeDefined();
    expect(
      bodyUsesSensitivePrearrival(
        `Tu acceso: {{${sensitiveVar!.variable}}}`,
      ),
    ).toBe(true);
  });

  it("returns false for bodies with only safe_always vars", () => {
    expect(bodyUsesSensitivePrearrival("Hola {{guest_name}}")).toBe(false);
  });
});

describe("sensitive_prearrival runtime block on materialization", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("blocks a draft whose scheduledSendAt is >= check-in moment (post-arrival)", async () => {
    const sensitiveVar = messagingVariables.items.find(
      (v) => v.sendPolicy === "sensitive_prearrival",
    )!;
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: "r_1",
      propertyId: "p_1",
      status: "confirmed",
      guestName: "Ana",
      checkInDate: new Date("2026-05-10T00:00:00Z"),
      checkOutDate: new Date("2026-05-13T00:00:00Z"),
      numGuests: 2,
      locale: "es",
      createdAt: new Date("2026-04-01T00:00:00Z"),
    });
    prismaMock.property.findUnique.mockResolvedValue({
      id: "p_1",
      timezone: "Europe/Madrid",
      checkInStart: "16:00",
      checkOutTime: "11:00",
    });
    prismaMock.messageAutomation.findMany.mockResolvedValue([
      {
        id: "auto_sens",
        templateId: "tpl_1",
        channelKey: "email",
        triggerType: "day_of_checkin",
        sendOffsetMinutes: 60, // 1h AFTER check-in → post-arrival
        touchpointKey: "arrival_day",
        template: {
          id: "tpl_1",
          bodyMd: `Código: {{${sensitiveVar.variable}}}`,
        },
      },
    ]);

    const outcomes = await materializeDraftsForReservation("r_1");
    expect(outcomes[0].outcome).toBe("blocked_sensitive_prearrival");
    expect(prismaMock.messageDraft.create).not.toHaveBeenCalled();
  });

  it("allows a draft whose scheduledSendAt is strictly before check-in", async () => {
    const sensitiveVar = messagingVariables.items.find(
      (v) => v.sendPolicy === "sensitive_prearrival",
    )!;
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: "r_1",
      propertyId: "p_1",
      status: "confirmed",
      guestName: "Ana",
      checkInDate: new Date("2026-05-10T00:00:00Z"),
      checkOutDate: new Date("2026-05-13T00:00:00Z"),
      numGuests: 2,
      locale: "es",
      createdAt: new Date("2026-04-01T00:00:00Z"),
    });
    prismaMock.property.findUnique.mockResolvedValue({
      id: "p_1",
      timezone: "Europe/Madrid",
      checkInStart: "16:00",
      checkOutTime: "11:00",
    });
    prismaMock.messageAutomation.findMany.mockResolvedValue([
      {
        id: "auto_safe",
        templateId: "tpl_1",
        channelKey: "email",
        triggerType: "before_arrival",
        sendOffsetMinutes: -120, // 2h before
        touchpointKey: "pre_arrival",
        template: {
          id: "tpl_1",
          bodyMd: `Código: {{${sensitiveVar.variable}}}`,
        },
      },
    ]);
    prismaMock.messageDraft.findUnique.mockResolvedValue(null);
    prismaMock.messageDraft.create.mockResolvedValue({ id: "d_new" });

    const outcomes = await materializeDraftsForReservation("r_1");
    expect(outcomes[0].outcome).toBe("created");
  });

  // Lower-bound guard: a sensitive template scheduled outside the allowed lead
  // window (currently 48 h) must also be blocked. Otherwise a wifi password or
  // door code sitting in the guest's inbox for two weeks is exactly the leak
  // the `sensitive_prearrival` policy exists to prevent.
  it("blocks a sensitive draft scheduled too early (wifi_password 14 days before)", async () => {
    const sensitiveVar = messagingVariables.items.find(
      (v) => v.sendPolicy === "sensitive_prearrival",
    )!;
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: "r_1",
      propertyId: "p_1",
      status: "confirmed",
      guestName: "Ana",
      checkInDate: new Date("2026-05-10T00:00:00Z"),
      checkOutDate: new Date("2026-05-13T00:00:00Z"),
      numGuests: 2,
      locale: "es",
      createdAt: new Date("2026-04-01T00:00:00Z"),
    });
    prismaMock.property.findUnique.mockResolvedValue({
      id: "p_1",
      timezone: "Europe/Madrid",
      checkInStart: "16:00",
      checkOutTime: "11:00",
    });
    prismaMock.messageAutomation.findMany.mockResolvedValue([
      {
        id: "auto_too_early",
        templateId: "tpl_1",
        channelKey: "email",
        triggerType: "before_arrival",
        sendOffsetMinutes: -14 * 24 * 60, // 14 days before check-in
        touchpointKey: "pre_arrival",
        template: {
          id: "tpl_1",
          bodyMd: `Tu wifi: {{${sensitiveVar.variable}}}`,
        },
      },
    ]);

    const outcomes = await materializeDraftsForReservation("r_1");
    expect(outcomes[0].outcome).toBe("blocked_sensitive_prearrival");
    expect(prismaMock.messageDraft.create).not.toHaveBeenCalled();
  });

  it("allows a sensitive draft exactly at the lead-window boundary", async () => {
    // Boundary is inclusive at `checkIn − SENSITIVE_PREARRIVAL_MAX_LEAD_HOURS`:
    // equality passes (scheduledSendAt === earliestAllowed), just outside blocks.
    const sensitiveVar = messagingVariables.items.find(
      (v) => v.sendPolicy === "sensitive_prearrival",
    )!;
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: "r_1",
      propertyId: "p_1",
      status: "confirmed",
      guestName: "Ana",
      checkInDate: new Date("2026-05-10T00:00:00Z"),
      checkOutDate: new Date("2026-05-13T00:00:00Z"),
      numGuests: 2,
      locale: "es",
      createdAt: new Date("2026-04-01T00:00:00Z"),
    });
    prismaMock.property.findUnique.mockResolvedValue({
      id: "p_1",
      timezone: "Europe/Madrid",
      checkInStart: "16:00",
      checkOutTime: "11:00",
    });
    prismaMock.messageAutomation.findMany.mockResolvedValue([
      {
        id: "auto_at_boundary",
        templateId: "tpl_1",
        channelKey: "email",
        triggerType: "before_arrival",
        sendOffsetMinutes: -SENSITIVE_PREARRIVAL_MAX_LEAD_HOURS * 60,
        touchpointKey: "pre_arrival",
        template: {
          id: "tpl_1",
          bodyMd: `Tu wifi: {{${sensitiveVar.variable}}}`,
        },
      },
    ]);
    prismaMock.messageDraft.findUnique.mockResolvedValue(null);
    prismaMock.messageDraft.create.mockResolvedValue({ id: "d_new" });

    const outcomes = await materializeDraftsForReservation("r_1");
    expect(outcomes[0].outcome).toBe("created");
  });
});
