import { createHash } from "node:crypto";
import {
  PROVIDER_PRIORITY,
  type NormalizedEventCandidate,
} from "./contracts";

// ── Canonicalization ──
// Groups candidates from different sources that refer to the same real-world
// event. Conservative: when in doubt, keep two canonical rows over wrongly
// merging — the aggregator prefers a duplicate row (showing twice in the
// operator view) over collapsing two distinct events into one.

export interface CanonicalEventGroup {
  canonicalKey: string;
  /** Candidates that all refer to the same real-world event. At least one. */
  candidates: NormalizedEventCandidate[];
  /** "strong" when every member matched by title+slot+venue; "heuristic"
   * when at least one pairing relied on similarity scoring. Surfaces in
   * warnings for operator visibility. */
  matchKind: "strong" | "heuristic";
}

// ── Normalization helpers ──

function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeTitle(title: string): string {
  return stripAccents(title.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeVenue(venue: string | undefined): string {
  if (!venue) return "";
  return stripAccents(venue.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Floor to 15-minute slot so small TZ/minute drift across sources doesn't
 * break strong matches. */
export function startSlot(d: Date): number {
  return Math.floor(d.getTime() / (15 * 60 * 1000));
}

// ── Similarity (token-set Jaccard, fast enough for O(n^2) over a tick) ──

function tokenSet(s: string): Set<string> {
  const tokens = s.split(" ").filter((t) => t.length > 2);
  return new Set(tokens);
}

export function titleSimilarity(a: string, b: string): number {
  const ta = tokenSet(normalizeTitle(a));
  const tb = tokenSet(normalizeTitle(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ── Distance (haversine, km) ──

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ── Provider-family priority ──

export function providerFamily(source: string): string {
  const colon = source.indexOf(":");
  return colon === -1 ? source : source.slice(0, colon);
}

export function familyPriority(source: string): number {
  const family = providerFamily(source) as keyof typeof PROVIDER_PRIORITY;
  return PROVIDER_PRIORITY[family] ?? 0;
}

// ── Match predicates ──

function strongMatch(
  a: NormalizedEventCandidate,
  b: NormalizedEventCandidate,
): boolean {
  if (startSlot(a.startsAt) !== startSlot(b.startsAt)) return false;
  if (normalizeTitle(a.title) !== normalizeTitle(b.title)) return false;
  const va = normalizeVenue(a.venueName);
  const vb = normalizeVenue(b.venueName);
  // Require venue-string equality when both sides expose it. If either side
  // omits venue, the exact title+slot pairing is strong enough on its own.
  if (va && vb) return va === vb;
  return true;
}

function heuristicMatch(
  a: NormalizedEventCandidate,
  b: NormalizedEventCandidate,
): boolean {
  // Start must be within 60 minutes (4 slots).
  if (Math.abs(startSlot(a.startsAt) - startSlot(b.startsAt)) > 4) return false;

  // Titles must share enough token structure. Jaccard ≥ 0.60 — tighter
  // than typical fuzzy-match thresholds because conservative merging is
  // the invariant.
  if (titleSimilarity(a.title, b.title) < 0.6) return false;

  // Venue agreement OR geographic proximity.
  const va = normalizeVenue(a.venueName);
  const vb = normalizeVenue(b.venueName);
  if (va && vb && va === vb) return true;

  const hasGeoA =
    typeof a.latitude === "number" && typeof a.longitude === "number";
  const hasGeoB =
    typeof b.latitude === "number" && typeof b.longitude === "number";
  if (hasGeoA && hasGeoB) {
    const km = haversineKm(
      { latitude: a.latitude as number, longitude: a.longitude as number },
      { latitude: b.latitude as number, longitude: b.longitude as number },
    );
    if (km <= 0.5) return true;
  }

  return false;
}

// ── Canonical key ──

export function deriveCanonicalKey(seed: NormalizedEventCandidate): string {
  const parts = [
    normalizeTitle(seed.title),
    String(startSlot(seed.startsAt)),
    normalizeVenue(seed.venueName),
  ].join("|");
  return createHash("sha1").update(parts).digest("hex").slice(0, 20);
}

// ── Canonicalize ──
// Seeds groups in priority order so strong matches land against the
// best-quality candidate. Each new candidate attempts strong match first,
// then heuristic. No match → new group. Pure function, deterministic given
// a stable input order.

export function canonicalizeCandidates(
  candidates: ReadonlyArray<NormalizedEventCandidate>,
): CanonicalEventGroup[] {
  const sorted = [...candidates].sort((a, b) => {
    const pa = familyPriority(a.source);
    const pb = familyPriority(b.source);
    if (pa !== pb) return pb - pa;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    // Stable fallback: lexicographic on source then id.
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.sourceExternalId.localeCompare(b.sourceExternalId);
  });

  const groups: CanonicalEventGroup[] = [];

  for (const c of sorted) {
    let placed = false;
    for (const g of groups) {
      const seed = g.candidates[0];
      if (strongMatch(seed, c)) {
        g.candidates.push(c);
        placed = true;
        break;
      }
    }
    if (placed) continue;

    for (const g of groups) {
      const seed = g.candidates[0];
      if (heuristicMatch(seed, c)) {
        g.candidates.push(c);
        g.matchKind = "heuristic";
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push({
        canonicalKey: deriveCanonicalKey(c),
        candidates: [c],
        matchKind: "strong",
      });
    }
  }

  return groups;
}
