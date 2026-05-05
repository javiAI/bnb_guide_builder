// Messaging scheduler tick.
//
// Runs on a cron cadence (Vercel Cron hits `/api/cron/messaging`). Two jobs:
//
//  1. Materialize drafts: for every upcoming reservation within the lookahead
//     window, call `materializeDraftsForReservation` so active automations
//     produce fresh `pending_review` drafts. Idempotent.
//  2. Dispatch: list `approved` drafts with `scheduledSendAt <= now` and mark
//     them `sent`. No provider (email/WhatsApp) runs here — the engine only
//     marks drafts as sent; real provider integration is deferred.
//
// Contract: `runTick(now)` is pure with respect to its input — the only
// side-effect is database writes. Callers can freeze `now` in tests.

import { prisma } from "@/lib/db";
import {
  listDueDrafts,
  materializeDraftsForReservation,
  transitionDraftAction,
  type MaterializationOutcome,
} from "./messaging-automation.service";

export interface TickReport {
  now: string;
  materialized: {
    reservationsScanned: number;
    outcomes: MaterializationOutcome[];
  };
  dispatched: {
    drafts: number;
    errors: { draftId: string; reason: string }[];
  };
}

const DEFAULT_LOOKAHEAD_DAYS = 30;

export async function runTick(
  now: Date = new Date(),
  options: { lookaheadDays?: number; dispatchLimit?: number } = {},
): Promise<TickReport> {
  const lookaheadDays = options.lookaheadDays ?? DEFAULT_LOOKAHEAD_DAYS;
  const lookaheadEnd = new Date(now.getTime() + lookaheadDays * 86400 * 1000);
  // `checkInDate` / `checkOutDate` are `@db.Date` (date-only, stored as UTC
  // midnight). Comparing them against a mid-day `now` would exclude a
  // reservation checking out *today* as soon as `now > 00:00`. Anchor the
  // comparison at the start of today (UTC) so day-of-checkout stays in scope.
  const startOfTodayUtc = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );

  // 1. Materialize — any future or currently in-window reservation.
  const reservations = await prisma.reservation.findMany({
    where: {
      status: "confirmed",
      // Any reservation whose check-out is today or later OR whose check-in is
      // within lookahead. Belts + suspenders: also include freshly created
      // reservations (bookingConfirmed trigger fires near createdAt).
      OR: [
        { checkOutDate: { gte: startOfTodayUtc } },
        { checkInDate: { gte: startOfTodayUtc, lte: lookaheadEnd } },
        { createdAt: { gte: new Date(now.getTime() - 86400 * 1000) } },
      ],
    },
    select: { id: true },
  });

  // Materialize all reservations in parallel — each call is independent and
  // `materializeDraftsForReservation` is idempotent. Sequential awaits would
  // serialize N+1 round-trips per tick.
  const outcomes: MaterializationOutcome[] = (
    await Promise.all(reservations.map((r) => materializeDraftsForReservation(r.id)))
  ).flat();

  // 2. Dispatch due drafts. No provider here — the engine just marks them
  // sent. A future branch swaps this for a real dispatcher.
  const due = await listDueDrafts(now, { limit: options.dispatchLimit ?? 100 });
  const results = await Promise.all(
    due.map((draft) =>
      transitionDraftAction(draft.id, "mark_sent", {
        actorId: "scheduler",
        note: "scheduler_tick_dispatch",
      }).then((result) => ({ draft, result })),
    ),
  );
  const dispatchErrors: { draftId: string; reason: string }[] = [];
  for (const { draft, result } of results) {
    if (!result.ok) {
      dispatchErrors.push({ draftId: draft.id, reason: result.reason });
    }
  }

  return {
    now: now.toISOString(),
    materialized: {
      reservationsScanned: reservations.length,
      outcomes,
    },
    dispatched: {
      drafts: due.length - dispatchErrors.length,
      errors: dispatchErrors,
    },
  };
}
