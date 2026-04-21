import {
  type NormalizedEventCandidate,
  type PriceInfo,
} from "./contracts";
import {
  familyPriority,
  providerFamily,
  type CanonicalEventGroup,
} from "./canonicalize";

// ── Merged canonical event ──
// Output of the merge layer: a single row per canonical event that the
// sync service persists as `LocalEvent`. Per-candidate rows land in
// `LocalEventSourceLink`. This struct intentionally does NOT carry
// per-source fields — it is the canonical view.

export interface MergedCanonicalEvent {
  canonicalKey: string;
  title: string;
  descriptionMd?: string;
  categoryKey: string;
  startsAt: Date;
  endsAt?: Date;
  venueName?: string;
  venueAddress?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  sourceUrl: string;
  priceInfo?: PriceInfo;
  confidence: number;
  /** The source that "drives" the canonical view for the primary fields.
   * Chosen by provider priority, then confidence, then source string. */
  primarySource: string;
  /** Every source that contributed at least one candidate to this group,
   * including the primary. Deduped. */
  contributingSources: string[];
  /** Warnings to forward to the operator (e.g. heuristic match,
   * per-field overrides). */
  mergeWarnings: string[];
}

// ── Primary selection ──

function pickPrimary(
  candidates: ReadonlyArray<NormalizedEventCandidate>,
): NormalizedEventCandidate {
  return [...candidates].sort((a, b) => {
    const pa = familyPriority(a.source);
    const pb = familyPriority(b.source);
    if (pa !== pb) return pb - pa;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.sourceExternalId.localeCompare(b.sourceExternalId);
  })[0];
}

// ── Field-level rules ──
// Per-field pickers. `byPriority` walks candidates in priority order and
// returns the first non-empty value. `fromFamily` prefers a specific
// provider family (e.g. "ticketmaster" for clickable URLs) and falls
// back to byPriority when that family is absent from the group.

function byPriority<T>(
  candidates: ReadonlyArray<NormalizedEventCandidate>,
  pick: (c: NormalizedEventCandidate) => T | undefined,
): T | undefined {
  const sorted = [...candidates].sort(
    (a, b) => familyPriority(b.source) - familyPriority(a.source),
  );
  for (const c of sorted) {
    const v = pick(c);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

// Returns the first non-empty picked value across ALL candidates in the
// requested family, walking them in the same priority order as `byPriority`.
// Picking only `candidates.find(...)` would return `undefined` whenever the
// first family member lacked the field — even when another member had it —
// silently breaking rules like "Firecrawl wins imageUrl" for canonical
// groups with multiple curated Firecrawl sources.
function fromFamily<T>(
  candidates: ReadonlyArray<NormalizedEventCandidate>,
  family: string,
  pick: (c: NormalizedEventCandidate) => T | undefined,
): T | undefined {
  const familyCandidates = candidates.filter(
    (c) => providerFamily(c.source) === family,
  );
  return byPriority(familyCandidates, pick);
}

function uniqueContributing(
  candidates: ReadonlyArray<NormalizedEventCandidate>,
): string[] {
  return Array.from(new Set(candidates.map((c) => c.source))).sort((a, b) => {
    const pa = familyPriority(a);
    const pb = familyPriority(b);
    if (pa !== pb) return pb - pa;
    return a.localeCompare(b);
  });
}

// ── Merge ──
// Rules:
//   - title, descriptionMd, categoryKey, startsAt, endsAt, venueName,
//     venueAddress, latitude/longitude, priceInfo: by provider priority
//     (PHQ > Firecrawl > TM), falling back to the next source when the
//     top source lacks the field.
//   - sourceUrl: Ticketmaster wins when present (its link is clickable
//     and goes to a real ticket page). Otherwise, by priority.
//   - imageUrl: Firecrawl wins when present (curated tourism sites ship
//     better hero imagery than TM thumbs). Otherwise, by priority.
//   - confidence: max across candidates (a well-ranked PHQ event stays
//     well-ranked even when a lower-priority source contributes only
//     minor fields).
//   - lat/lng: both-or-neither is preserved per contract; we only accept
//     the pair from the same candidate so we never mix coordinates.

export function mergeCanonicalGroup(
  group: CanonicalEventGroup,
): MergedCanonicalEvent {
  const primary = pickPrimary(group.candidates);

  const title = byPriority(group.candidates, (c) => c.title) ?? primary.title;
  const descriptionMd = byPriority(group.candidates, (c) => c.descriptionMd);
  const categoryKey =
    byPriority(group.candidates, (c) => c.categoryKey) ?? primary.categoryKey;
  const startsAt =
    byPriority(group.candidates, (c) => c.startsAt) ?? primary.startsAt;
  const endsAt = byPriority(group.candidates, (c) => c.endsAt);
  const venueName = byPriority(group.candidates, (c) => c.venueName);
  const venueAddress = byPriority(group.candidates, (c) => c.venueAddress);

  const geoCandidate = [...group.candidates]
    .sort((a, b) => familyPriority(b.source) - familyPriority(a.source))
    .find(
      (c) => typeof c.latitude === "number" && typeof c.longitude === "number",
    );

  const imageUrl =
    fromFamily(group.candidates, "firecrawl", (c) => c.imageUrl) ??
    byPriority(group.candidates, (c) => c.imageUrl);

  const sourceUrl =
    fromFamily(group.candidates, "ticketmaster", (c) => c.sourceUrl) ??
    byPriority(group.candidates, (c) => c.sourceUrl) ??
    primary.sourceUrl;

  const priceInfo = byPriority(group.candidates, (c) => c.priceInfo);

  const confidence = group.candidates.reduce(
    (max, c) => (c.confidence > max ? c.confidence : max),
    0,
  );

  const warnings: string[] = [];
  if (group.matchKind === "heuristic") {
    warnings.push(
      `canonical group "${title}" merged heuristically across ${group.candidates.length} candidates — verify`,
    );
  }

  return {
    canonicalKey: group.canonicalKey,
    title,
    ...(descriptionMd ? { descriptionMd } : {}),
    categoryKey,
    startsAt,
    ...(endsAt ? { endsAt } : {}),
    ...(venueName ? { venueName } : {}),
    ...(venueAddress ? { venueAddress } : {}),
    ...(geoCandidate && geoCandidate.latitude !== undefined && geoCandidate.longitude !== undefined
      ? { latitude: geoCandidate.latitude, longitude: geoCandidate.longitude }
      : {}),
    ...(imageUrl ? { imageUrl } : {}),
    sourceUrl,
    ...(priceInfo ? { priceInfo } : {}),
    confidence,
    primarySource: primary.source,
    contributingSources: uniqueContributing(group.candidates),
    mergeWarnings: warnings,
  };
}
