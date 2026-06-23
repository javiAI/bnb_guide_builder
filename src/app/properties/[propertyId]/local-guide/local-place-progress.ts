import { findLocalPlaceCategory } from "@/lib/taxonomies/local-place-categories";

export type LocalPlaceProgressLevel = "empty" | "partial" | "complete";

/** The subset of a LocalPlace row the status resolver needs. Structural, so the
 * server page can pass the Prisma row and the client card its serialized data. */
export interface LocalPlaceProgressInput {
  categoryKey: string;
  distanceMeters: number | null;
  shortNote: string | null;
  guestDescription: string | null;
}

function hasGuestNote(place: LocalPlaceProgressInput): boolean {
  return Boolean(place.shortNote?.trim() || place.guestDescription?.trim());
}

/**
 * Guest-meaningful completeness for a local place (mirror of
 * `space-progress.ts` — pure, no React, identical on server + client):
 *
 *   - `complete` → valid category AND (a distance OR a host note). Either
 *     signal makes the guide card useful, so they form a disjunction — not a
 *     checklist of independent signals like spaces.
 *   - `partial`  → valid category but neither distance nor note yet.
 *   - `empty`    → category doesn't resolve in the taxonomy (defensive only —
 *     not reachable through the UI, which always picks from taxonomy chips).
 */
export function resolveLocalPlaceStatus(
  place: LocalPlaceProgressInput,
): LocalPlaceProgressLevel {
  if (!findLocalPlaceCategory(place.categoryKey)) return "empty";
  return place.distanceMeters != null || hasGuestNote(place)
    ? "complete"
    : "partial";
}

/**
 * The unmet signals behind a non-complete status, as operator-facing labels —
 * surfaced on the status pill's hover so "En progreso" explains itself.
 * Mirrors resolveLocalPlaceStatus exactly: a complete place returns [].
 */
export function missingLocalPlaceSignals(
  place: LocalPlaceProgressInput,
): string[] {
  const missing: string[] = [];
  if (!findLocalPlaceCategory(place.categoryKey)) {
    missing.push("una categoría válida");
  }
  if (place.distanceMeters == null && !hasGuestNote(place)) {
    missing.push("la distancia", "una nota para el huésped");
  }
  return missing;
}
