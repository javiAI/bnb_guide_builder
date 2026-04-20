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
//   with `sendPolicy = "sensitive_prearrival"`, the draft only materializes when
//   `scheduledSendAt` is before the check-in moment of the reservation. Templates
//   using `internal_only` variables are blocked at automation *creation* time
//   (never reach this service) — so we do not re-check here.
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
import {
  extractVariableTokens,
  resolveVariables,
} from "@/lib/services/messaging-variables.service";
import type { ReservationContextRow } from "@/lib/services/messaging-variables-resolvers";
import { normaliseTriggerType } from "@/lib/schemas/messaging.schema";

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

export interface MaterializationOutcome {
  automationId: string;
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
    await cancelDraftsForReservation(reservationId, { client: db });
    return [
      {
        automationId: "",
        reservationId,
        draftId: null,
        outcome: "blocked_reservation_cancelled",
      },
    ];
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

  const outcomes: MaterializationOutcome[] = [];
  for (const automation of automations) {
    const outcome = await materializeSingleDraft({
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
    outcomes.push(outcome);
  }
  return outcomes;
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

  // Safety: sensitive_prearrival tokens may only materialize when
  // scheduledSendAt is strictly before the check-in instant.
  const checkInInstant = zonedDateToInstant({
    date: reservation.checkInDate,
    time: property.checkInStart ?? "16:00",
    timezone: property.timezone ?? "UTC",
  });
  if (
    checkInInstant &&
    scheduledSendAt >= checkInInstant &&
    bodyUsesSensitivePrearrival(automation.template.bodyMd)
  ) {
    return {
      ...base,
      draftId: null,
      outcome: "blocked_sensitive_prearrival",
    };
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
 * trigger's anchor and the automation offset. Returns `null` if the property
 * has no anchor time (e.g. check-out without `checkOutTime`). */
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

  for (const draft of drafts) {
    await db.messageDraft.update({
      where: { id: draft.id },
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
  }
  return drafts.length;
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
  await db.messageDraft.update({
    where: { id: draftId },
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
  await db.messageDraft.update({
    where: { id: draftId },
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
