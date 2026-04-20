// Hard invariants — DO NOT relax:
//   - audience is ALWAYS "guest". Never read it from request input.
//   - locale comes from `Property.defaultLocale`, not from the request.
//   - allowedVisibilitiesFor("guest") from the retriever excludes "sensitive".

import { prisma } from "@/lib/db";
import {
  hybridRetrieve,
  type RetrievedItem,
} from "@/lib/services/assistant/retriever";
import { getSectionIdForEntity, getGuideSectionConfig } from "@/lib/taxonomy-loader";

export interface GuideSemanticHit {
  itemId: string;
  sectionId: string;
  sectionLabel: string;
  anchor: string;
  label: string;
  snippet: string;
  score: number;
}

export interface GuideSemanticSearchResponse {
  hits: GuideSemanticHit[];
  degraded: boolean;
}

export interface GuideSemanticSearchInput {
  slug: string;
  query: string;
}

export type GuideSemanticSearchResult =
  | { kind: "ok"; data: GuideSemanticSearchResponse }
  | { kind: "not-found" }
  | { kind: "rate-limited"; retryAfterSeconds: number };

const TOP_K = 5;
const SNIPPET_MAX_LENGTH = 180;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

// In-memory rate limit is sufficient for the MVP (single Next process per
// region, read-only abuse risk). Multi-region → Redis.

const rateBuckets = new Map<string, number[]>();

function checkRateLimit(slug: string, now: number): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const existing = rateBuckets.get(slug);
  const pruned = existing ? existing.filter((t) => t > windowStart) : [];
  if (pruned.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateBuckets.set(slug, pruned);
    const oldest = pruned[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }
  pruned.push(now);
  rateBuckets.set(slug, pruned);
  return { allowed: true, retryAfterSeconds: 0 };
}

// Periodically drop buckets that have fully aged out so the Map doesn't grow
// unbounded across unique slugs (e.g. a crawler hitting `/api/g/<any>/search`).
function pruneIdleBuckets(now: number): void {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  for (const [slug, timestamps] of rateBuckets) {
    const latest = timestamps[timestamps.length - 1];
    if (latest === undefined || latest <= windowStart) rateBuckets.delete(slug);
  }
}

/** Test-only: clear the rate-limit window for a specific slug (or all). */
export function __resetRateLimitForTests(slug?: string): void {
  if (slug) rateBuckets.delete(slug);
  else rateBuckets.clear();
}

function stripMdLite(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSnippet(item: RetrievedItem): string {
  if (item.canonicalQuestion && item.canonicalQuestion.trim().length > 0) {
    return item.canonicalQuestion.trim().slice(0, SNIPPET_MAX_LENGTH);
  }
  const stripped = stripMdLite(item.bodyMd);
  if (stripped.length <= SNIPPET_MAX_LENGTH) return stripped;
  return `${stripped.slice(0, SNIPPET_MAX_LENGTH - 1).trimEnd()}…`;
}

export async function guideSemanticSearch(
  input: GuideSemanticSearchInput,
): Promise<GuideSemanticSearchResult> {
  const now = Date.now();
  if (rateBuckets.size > 256) pruneIdleBuckets(now);
  const gate = checkRateLimit(input.slug, now);
  if (!gate.allowed) {
    return { kind: "rate-limited", retryAfterSeconds: gate.retryAfterSeconds };
  }

  const property = await prisma.property.findUnique({
    where: { publicSlug: input.slug },
    select: { id: true, defaultLocale: true },
  });
  if (!property) return { kind: "not-found" };

  // Mirror the public page at `/g/[slug]`: no published version → 404.
  const published = await prisma.guideVersion.findFirst({
    where: { propertyId: property.id, status: "published" },
    select: { id: true },
  });
  if (!published) return { kind: "not-found" };

  const result = await hybridRetrieve(
    input.query,
    {
      propertyId: property.id,
      locale: property.defaultLocale,
      audience: "guest",
    },
    { topK: TOP_K },
  );

  const hits: GuideSemanticHit[] = [];
  for (const item of result.items) {
    const sectionId = getSectionIdForEntity(item.entityType, item.journeyStage);
    if (!sectionId) continue;
    const sectionConfig = getGuideSectionConfig(sectionId);
    if (!sectionConfig) continue;

    hits.push({
      itemId: item.id,
      sectionId,
      sectionLabel: sectionConfig.label,
      anchor: item.entityId ? `item-${item.entityId}` : `section-${sectionId}`,
      label:
        item.canonicalQuestion && item.canonicalQuestion.trim().length > 0
          ? item.canonicalQuestion.trim()
          : item.topic,
      snippet: buildSnippet(item),
      score: item.rrfScore,
    });
  }

  return {
    kind: "ok",
    data: {
      hits,
      degraded: result.degraded,
    },
  };
}

export const __guide_search_internal = {
  stripMdLite,
  buildSnippet,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  TOP_K,
  SNIPPET_MAX_LENGTH,
};
