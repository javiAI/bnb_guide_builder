// Messaging automations — materialization engine.
//
// Materializes `MessageDraft` rows per `(automationId, reservationId)`: idempotent,
// scheduled-timezone-aware, safety-gated. No dispatch happens here — the scheduler
// tick (`messaging-scheduler.ts`) flips drafts to `approved/sent` downstream and
// the reviewer UI drives the lifecycle.
//
// Contract:
// - One reservation × one automation → at most one draft (`@@unique([automationId, reservationId])`).
// - `scheduledSendAt` is precomputed at materialization time from the reservation
//   anchor field (checkIn / checkOut / bookingConfirmed) + the trigger offset, in
//   the property's timezone. Stored UTC.
// - Safety gate (`sensitive_prearrival`): if the resolved body depends on a variable
//   with `sendPolicy = "sensitive_prearrival"`, the draft only materializes inside
//   the allowed pre-arrival window `[checkIn − SENSITIVE_PREARRIVAL_MAX_LEAD_MS,
//   checkIn)`. Sending *after* arrival is blocked (defeats the point) AND sending
//   too early is blocked (e.g. a wifi_password rendered 14 days before arrival
//   shouldn't end up materialized by accident). Templates using `internal_only`
//   variables are blocked at automation *creation* time — we do not re-check here.
// - Cancel cascade: when a reservation is cancelled, any draft in `pending_review`
//   or `approved` transitions to `cancelled`. `sent / skipped / error` untouched.
// - Reservation edits: only `pending_review` drafts are re-scheduled in-place. Any
//   other status is immutable from this service.

import type { Prisma, PrismaClient } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/db";
import {
  findMessagingTrigger,
  messagingVariablesByToken,
  type MessagingTriggerItem,
} from "@/lib/taxonomy-loader";
import { resolveVariables } from "@/lib/services/messaging-variables.service";
import {
  extractVariableTokens,
  SENSITIVE_PREARRIVAL_MAX_LEAD_HOURS,
  SENSITIVE_PREARRIVAL_MAX_LEAD_MS,
} from "@/lib/services/messaging-shared";
import type { ReservationContextRow } from "@/lib/services/messaging-variables-resolvers";
import { normaliseTriggerType } from "@/lib/schemas/messaging.schema";
import { isPrismaUniqueViolation, mapWithConcurrency } from "@/lib/utils";

/** Cap on parallel `materializeSingleDraft` calls in the non-tx path. Each
 * call hits the DB (template variable resolution + draft upsert); a single
 * property with hundreds of automations is rare today but unbounded
 * `Promise.all` would still fan out to the same pool the cron is hitting in
 * parallel. Aligned with `messaging-scheduler.ts` MATERIALIZE_CONCURRENCY. */
const MATERIALIZE_AUTOMATION_CONCURRENCY = 4;

// ─── Public types ────────────────────────────────────────────────────────

export const DRAFT_STATUSES = [
  "pending_review",
  "approved",
  "sent",
  "skipped",
  "cancelled",
  "error",
] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const RESERVATION_STATUSES = [
  "confirmed",
  "cancelled",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export { SENSITIVE_PREARRIVAL_MAX_LEAD_HOURS };

export interface MaterializationOutcome {
  /** `null` when the outcome is a reservation-wide event (cancellation cascade)
   * rather than a per-automation result. */
  automationId: string | null;
  reservationId: string;
  /** Set when a row was upserted. */
  draftId: string | null;
  outcome:
    | "created"
    | "updated"
    | "unchanged"
    | "blocked_sensitive_prearrival"
    | "blocked_missing_anchor"
    | "blocked_trigger_unknown"
    | "blocked_reservation_cancelled";
}

export interface DraftLifecycleEvent {
  at: string; // ISO instant
  from: string | null;
  to: string;
  actorId: string | null;
  note?: string;
}

// ─── Materialize drafts for a reservation ────────────────────────────────

/** Materialize (or refresh) drafts for every automation of the reservation's
 * property that applies to this reservation. Idempotent per automation. */
export async function materializeDraftsForReservation(
  reservationId: string,
  options: { client?: Prisma.TransactionClient } = {},
): Promise<MaterializationOutcome[]> {
  const db = options.client ?? prisma;

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      propertyId: true,
      status: true,
      guestName: true,
      checkInDate: true,
      checkOutDate: true,
      numGuests: true,
      locale: true,
      createdAt: true,
    },
  });
  if (!reservation) return [];

  if (reservation.status === "cancelled") {
    const affected = await db.messageDraft.findMany({
      where: {
        reservationId,
        status: { in: ["pending_review", "approved"] satisfies DraftStatus[] },
      },
      select: { id: true, automationId: true },
    });
    await cancelDraftsForReservation(reservationId, { client: db });
    if (affected.length === 0) {
      return [
        {
          automationId: null,
          reservationId,
          draftId: null,
          outcome: "blocked_reservation_cancelled",
        },
      ];
    }
    return affected.map((draft) => ({
      automationId: draft.automationId,
      reservationId,
      draftId: draft.id,
      outcome: "blocked_reservation_cancelled" as const,
    }));
  }

  const property = await db.property.findUnique({
    where: { id: reservation.propertyId },
    select: { id: true, timezone: true, checkInStart: true, checkOutTime: true },
  });
  if (!property) return [];

  const automations = await db.messageAutomation.findMany({
    where: { propertyId: reservation.propertyId, active: true },
    select: {
      id: true,
      templateId: true,
      channelKey: true,
      triggerType: true,
      sendOffsetMinutes: true,
      touchpointKey: true,
      template: { select: { id: true, bodyMd: true } },
    },
  });

  const buildArgs = (automation: (typeof automations)[number]) => ({
    db,
    reservation,
    property: {
      id: property.id,
      timezone: property.timezone,
      checkInStart: property.checkInStart,
      checkOutTime: property.checkOutTime,
    },
    automation,
  });

  // Prisma interactive transactions serialize queries — Promise.all would
  // throw under a tx client. Default path (no client) parallelizes with
  // bounded concurrency to keep the DB pool free for concurrent requests.
  if (options.client) {
    const outcomes: MaterializationOutcome[] = [];
    for (const automation of automations) {
      outcomes.push(await materializeSingleDraft(buildArgs(automation)));
    }
    return outcomes;
  }

  return mapWithConcurrency(automations, MATERIALIZE_AUTOMATION_CONCURRENCY, (a) =>
    materializeSingleDraft(buildArgs(a)),
  );
}

interface MaterializeArgs {
  db: Prisma.TransactionClient | PrismaClient;
  reservation: {
    id: string;
    propertyId: string;
    guestName: string;
    checkInDate: Date;
    checkOutDate: Date;
    numGuests: number;
    locale: string | null;
    createdAt: Date;
  };
  property: {
    id: string;
    timezone: string | null;
    checkInStart: string | null;
    checkOutTime: string | null;
  };
  automation: {
    id: string;
    templateId: string;
    channelKey: string;
    triggerType: string;
    sendOffsetMinutes: number;
    touchpointKey: string;
    template: { id: string; bodyMd: string } | null;
  };
}

async function materializeSingleDraft(
  args: MaterializeArgs,
): Promise<MaterializationOutcome> {
  const { db, reservation, property, automation } = args;
  const base = {
    automationId: automation.id,
    reservationId: reservation.id,
  };

  if (!automation.template) {
    return { ...base, draftId: null, outcome: "blocked_trigger_unknown" };
  }

  const triggerId = normaliseTriggerType(automation.triggerType);
  const trigger = triggerId ? findMessagingTrigger(triggerId) : null;
  if (!trigger) {
    return { ...base, draftId: null, outcome: "blocked_trigger_unknown" };
  }

  const scheduledSendAt = computeScheduledSendAt({
    trigger,
    reservation,
    property,
    offsetMinutes: automation.sendOffsetMinutes,
  });
  if (!scheduledSendAt) {
    return { ...base, draftId: null, outcome: "blocked_missing_anchor" };
  }

  const reservationCtx: ReservationContextRow = {
    id: reservation.id,
    guestName: reservation.guestName,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    numGuests: reservation.numGuests,
    locale: reservation.locale,
  };

  const resolution = await resolveVariables(
    reservation.propertyId,
    automation.template.bodyMd,
    { reservation: reservationCtx },
  );

  // Safety: sensitive_prearrival tokens only materialize inside the
  // `[checkIn − SENSITIVE_PREARRIVAL_MAX_LEAD_MS, checkIn)` window. Both
  // sides matter: after arrival the data is stale, before the window it
  // leaks sensitive content (e.g. wifi_password weeks early).
  const isSensitive = bodyUsesSensitivePrearrival(automation.template.bodyMd);
  const checkInInstant = zonedDateToInstant({
    date: reservation.checkInDate,
    time: property.checkInStart ?? "16:00",
    timezone: property.timezone ?? "UTC",
  });
  if (isSensitive) {
    // Fail-closed if the check-in instant can't be derived (invalid tz,
    // malformed checkInStart). For non-checkIn-anchored triggers
    // (e.g. on_booking_confirmed) scheduledSendAt may still compute, but
    // without a checkInInstant we can't evaluate the lead window — blocking
    // is safer than materializing an unchecked sensitive draft.
    if (!checkInInstant) {
      return {
        ...base,
        draftId: null,
        outcome: "blocked_sensitive_prearrival",
      };
    }
    const earliestAllowed = new Date(
      checkInInstant.getTime() - SENSITIVE_PREARRIVAL_MAX_LEAD_MS,
    );
    if (scheduledSendAt >= checkInInstant || scheduledSendAt < earliestAllowed) {
      return {
        ...base,
        draftId: null,
        outcome: "blocked_sensitive_prearrival",
      };
    }
  }

  const resolutionStatesJson = buildResolutionStatesJson(resolution.states);

  const existing = await db.messageDraft.findUnique({
    where: {
      automationId_reservationId: {
        automationId: automation.id,
        reservationId: reservation.id,
      },
    },
    select: {
      id: true,
      status: true,
      scheduledSendAt: true,
      bodyMd: true,
      lifecycleHistoryJson: true,
    },
  });

  const now = new Date();
  if (!existing) {
    const seed = appendLifecycle(null, {
      at: now.toISOString(),
      from: null,
      to: "pending_review",
      actorId: null,
    });
    try {
      const created = await db.messageDraft.create({
        data: {
          propertyId: reservation.propertyId,
          reservationId: reservation.id,
          automationId: automation.id,
          templateId: automation.templateId,
          touchpointKey: automation.touchpointKey,
          bodyMd: resolution.output,
          channelKey: automation.channelKey,
          scheduledSendAt,
          status: "pending_review",
          resolutionStatesJson,
          lifecycleHistoryJson: seed,
        },
        select: { id: true },
      });
      return { ...base, draftId: created.id, outcome: "created" };
    } catch (err) {
      // Race: another tick/retry created the draft between our findUnique and
      // this create. The unique constraint `@@unique([automationId, reservationId])`
      // fires P2002 — treat as the other caller's `created`, we're `unchanged`.
      // Any other error propagates.
      if (!isPrismaUniqueViolation(err)) throw err;
      const racedExisting = await db.messageDraft.findUnique({
        where: {
          automationId_reservationId: {
            automationId: automation.id,
            reservationId: reservation.id,
          },
        },
        select: { id: true },
      });
      return {
        ...base,
        draftId: racedExisting?.id ?? null,
        outcome: "unchanged",
      };
    }
  }

  // Existing row: only `pending_review` drafts track reservation edits.
  if (existing.status !== "pending_review") {
    return { ...base, draftId: existing.id, outcome: "unchanged" };
  }

  const sameSchedule =
    existing.scheduledSendAt?.getTime() === scheduledSendAt.getTime();
  const sameBody = existing.bodyMd === resolution.output;
  if (sameSchedule && sameBody) {
    return { ...base, draftId: existing.id, outcome: "unchanged" };
  }

  await db.messageDraft.update({
    where: { id: existing.id },
    data: {
      bodyMd: resolution.output,
      scheduledSendAt,
      resolutionStatesJson,
    },
  });
  return { ...base, draftId: existing.id, outcome: "updated" };
}

// ─── Schedule computation (timezone-aware) ───────────────────────────────

interface ScheduleArgs {
  trigger: MessagingTriggerItem;
  reservation: {
    checkInDate: Date;
    checkOutDate: Date;
    createdAt: Date;
  };
  property: {
    timezone: string | null;
    checkInStart: string | null;
    checkOutTime: string | null;
  };
  offsetMinutes: number;
}

/** Compute the UTC instant at which a draft should be dispatched, given the
 * trigger's anchor and the automation offset. For date-based anchors, missing
 * property times fall back to defaults (`16:00` check-in, `11:00` check-out).
 * Returns `null` only when no anchor instant can be resolved (e.g. invalid
 * `property.timezone`). */
export function computeScheduledSendAt(args: ScheduleArgs): Date | null {
  const tz = args.property.timezone ?? "UTC";

  let anchorInstant: Date | null = null;
  switch (args.trigger.anchorField) {
    case "checkIn":
      anchorInstant = zonedDateToInstant({
        date: args.reservation.checkInDate,
        time: args.property.checkInStart ?? "16:00",
        timezone: tz,
      });
      break;
    case "checkOut":
      anchorInstant = zonedDateToInstant({
        date: args.reservation.checkOutDate,
        time: args.property.checkOutTime ?? "11:00",
        timezone: tz,
      });
      break;
    case "bookingConfirmed":
      anchorInstant = args.reservation.createdAt;
      break;
  }
  if (!anchorInstant) return null;
  return new Date(anchorInstant.getTime() + args.offsetMinutes * 60 * 1000);
}

/** Combine an ISO calendar date (YYYY-MM-DD) and a local "HH:MM" time in a
 * given IANA timezone, returning the UTC instant. */
function zonedDateToInstant(args: {
  date: Date;
  time: string;
  timezone: string;
}): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(args.time.trim());
  if (!match) return null;
  const [, hh, mm] = match;
  const y = args.date.getUTCFullYear();
  const m = String(args.date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(args.date.getUTCDate()).padStart(2, "0");
  const local = `${y}-${m}-${d}T${hh}:${mm}:00`;
  try {
    return fromZonedTime(local, args.timezone);
  } catch {
    return null;
  }
}

// ─── Safety: sensitive_prearrival check on template body ─────────────────

/** True if the template body references any variable whose `sendPolicy` is
 * `"sensitive_prearrival"`. Used by the runtime safety gate. Check-time gate
 * for `"internal_only"` lives in the automation creation path. */
export function bodyUsesSensitivePrearrival(bodyMd: string): boolean {
  for (const token of extractVariableTokens(bodyMd)) {
    const item = messagingVariablesByToken.get(token);
    if (item?.sendPolicy === "sensitive_prearrival") return true;
  }
  return false;
}

/** True if the template body references any `internal_only` variable — blocks
 * automation creation at check time (never at materialization). */
export function bodyUsesInternalOnly(bodyMd: string): boolean {
  for (const token of extractVariableTokens(bodyMd)) {
    const item = messagingVariablesByToken.get(token);
    if (item?.sendPolicy === "internal_only") return true;
  }
  return false;
}

// ─── Cancel cascade ──────────────────────────────────────────────────────

/** Mark every non-terminal draft of a reservation as `cancelled`. Called when
 * a reservation is cancelled. `sent / skipped / error / cancelled` untouched. */
export async function cancelDraftsForReservation(
  reservationId: string,
  options: { client?: Prisma.TransactionClient; actorId?: string | null } = {},
): Promise<number> {
  const db = options.client ?? prisma;
  const actorId = options.actorId ?? null;
  const now = new Date().toISOString();

  const drafts = await db.messageDraft.findMany({
    where: {
      reservationId,
      status: { in: ["pending_review", "approved"] satisfies DraftStatus[] },
    },
    select: { id: true, status: true, lifecycleHistoryJson: true },
  });

  // Conditional write: if a draft transitions to a terminal status (sent /
  // skipped / error) between this read and the update, the `status` guard in
  // `updateMany` makes it a no-op (count === 0) and the lifecycle append is
  // discarded — preserves the "sent / skipped / error untouched" contract
  // under concurrency.
  let cancelled = 0;
  for (const draft of drafts) {
    const result = await db.messageDraft.updateMany({
      where: {
        id: draft.id,
        status: { in: ["pending_review", "approved"] satisfies DraftStatus[] },
      },
      data: {
        status: "cancelled",
        lifecycleHistoryJson: appendLifecycle(draft.lifecycleHistoryJson, {
          at: now,
          from: draft.status,
          to: "cancelled",
          actorId,
          note: "reservation_cancelled",
        }),
      },
    });
    if (result.count > 0) cancelled += 1;
  }
  return cancelled;
}

// ─── Draft lifecycle transitions (reviewer UI) ───────────────────────────

export type DraftLifecycleAction =
  | "approve"
  | "skip"
  | "discard"
  | "mark_sent"
  | "mark_error";

const LIFECYCLE_TRANSITIONS: Record<
  DraftLifecycleAction,
  { from: readonly DraftStatus[]; to: DraftStatus }
> = {
  approve: { from: ["pending_review"], to: "approved" },
  skip: { from: ["pending_review"], to: "skipped" },
  discard: { from: ["pending_review", "approved"], to: "cancelled" },
  mark_sent: { from: ["approved"], to: "sent" },
  mark_error: { from: ["approved", "pending_review"], to: "error" },
};

export async function transitionDraftAction(
  draftId: string,
  action: DraftLifecycleAction,
  options: { actorId?: string | null; note?: string; client?: Prisma.TransactionClient } = {},
): Promise<{ ok: true; newStatus: DraftStatus } | { ok: false; reason: string }> {
  const db = options.client ?? prisma;
  const draft = await db.messageDraft.findUnique({
    where: { id: draftId },
    select: { id: true, status: true, lifecycleHistoryJson: true },
  });
  if (!draft) return { ok: false, reason: "draft_not_found" };
  const transition = LIFECYCLE_TRANSITIONS[action];
  if (!transition.from.includes(draft.status as DraftStatus)) {
    return { ok: false, reason: `illegal_transition_from_${draft.status}` };
  }
  const newStatus = transition.to;
  const now = new Date().toISOString();
  // Conditional update — fails if a concurrent caller already moved the draft
  // out of `transition.from`. Avoids double-applied transitions + duplicate
  // lifecycle events under concurrency (cron + human clicking approve).
  const result = await db.messageDraft.updateMany({
    where: { id: draftId, status: { in: [...transition.from] } },
    data: {
      status: newStatus,
      lifecycleHistoryJson: appendLifecycle(draft.lifecycleHistoryJson, {
        at: now,
        from: draft.status,
        to: newStatus,
        actorId: options.actorId ?? null,
        note: options.note,
      }),
    },
  });
  if (result.count === 0) {
    return { ok: false, reason: `illegal_transition_concurrent` };
  }
  return { ok: true, newStatus };
}

export async function editDraftBody(
  draftId: string,
  newBodyMd: string,
  options: { actorId?: string | null; client?: Prisma.TransactionClient } = {},
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = options.client ?? prisma;
  const draft = await db.messageDraft.findUnique({
    where: { id: draftId },
    select: { id: true, status: true, lifecycleHistoryJson: true, bodyMd: true },
  });
  if (!draft) return { ok: false, reason: "draft_not_found" };
  if (draft.status !== "pending_review") {
    return { ok: false, reason: `illegal_edit_from_${draft.status}` };
  }
  if (draft.bodyMd === newBodyMd) return { ok: true };
  const now = new Date().toISOString();
  // Conditional update — rejects if the draft was approved/skipped/cancelled
  // between our read and this write.
  const result = await db.messageDraft.updateMany({
    where: { id: draftId, status: "pending_review" },
    data: {
      bodyMd: newBodyMd,
      lifecycleHistoryJson: appendLifecycle(draft.lifecycleHistoryJson, {
        at: now,
        from: draft.status,
        to: draft.status,
        actorId: options.actorId ?? null,
        note: "body_edited",
      }),
    },
  });
  if (result.count === 0) {
    return { ok: false, reason: `illegal_edit_concurrent` };
  }
  return { ok: true };
}

// ─── Due drafts (scheduler query) ────────────────────────────────────────

export interface DueDraftRow {
  id: string;
  propertyId: string;
  reservationId: string | null;
  automationId: string | null;
  bodyMd: string;
  channelKey: string | null;
  scheduledSendAt: Date;
  status: string;
}

/** List drafts in `approved` whose `scheduledSendAt` is at or before `now`.
 * Ordered oldest-scheduled-first. The scheduler tick (`runTick`) transitions
 * each to `sent` (no provider dispatch in 12B — placeholder). */
export async function listDueDrafts(
  now: Date,
  options: { limit?: number; client?: Prisma.TransactionClient } = {},
): Promise<DueDraftRow[]> {
  const db = options.client ?? prisma;
  const rows = await db.messageDraft.findMany({
    where: {
      status: "approved",
      scheduledSendAt: { lte: now },
    },
    select: {
      id: true,
      propertyId: true,
      reservationId: true,
      automationId: true,
      bodyMd: true,
      channelKey: true,
      scheduledSendAt: true,
      status: true,
    },
    orderBy: [{ scheduledSendAt: "asc" }],
    take: options.limit ?? 100,
  });
  return rows.filter(
    (r): r is DueDraftRow => r.scheduledSendAt !== null,
  ) as DueDraftRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function buildResolutionStatesJson(
  states: Awaited<ReturnType<typeof resolveVariables>>["states"],
): Prisma.InputJsonValue {
  const out: Record<string, { status: string; [k: string]: unknown }> = {};
  for (const [token, state] of Object.entries(states)) {
    if (state.status === "resolved") {
      out[token] = { status: "resolved", sourceUsed: state.sourceUsed };
    } else if (state.status === "missing") {
      out[token] = { status: "missing", label: state.label };
    } else if (state.status === "unknown") {
      out[token] = { status: "unknown", suggestion: state.suggestion };
    } else {
      out[token] = { status: "unresolved_context", label: state.label };
    }
  }
  return out as unknown as Prisma.InputJsonValue;
}

function appendLifecycle(
  prev: Prisma.JsonValue | null | undefined,
  event: DraftLifecycleEvent,
): Prisma.InputJsonValue {
  const base = Array.isArray(prev) ? (prev as unknown as DraftLifecycleEvent[]) : [];
  return [...base, event] as unknown as Prisma.InputJsonValue;
}
