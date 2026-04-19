// Hybrid retriever.
//
// Returns the union of BM25 (Postgres FTS on `bm25_tsv`) and vector
// (pgvector cosine on `embedding`), fused with Reciprocal Rank Fusion (k=60).
// All hard filters (propertyId, locale, visibility, journeyStage, validFrom/
// validTo) are pushed down to SQL — the retriever never hands the pipeline
// rows the audience cannot see.
//
// When more than 90% of the candidate scope lacks an embedding, we degrade
// to BM25-only and flag `degraded: true` so the caller can surface a
// "still indexing" hint instead of silently returning worse results.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  VISIBILITY_ORDER,
  type VisibilityLevel,
} from "@/lib/visibility";
import { resolveEmbeddingProvider } from "./embeddings.service";
import type { ChunkType, EntityType, JourneyStage } from "@/lib/types/knowledge";

// ============================================================================
// Contract
// ============================================================================

export interface HardFilters {
  propertyId: string;
  locale: string;
  audience: VisibilityLevel;
  journeyStage?: JourneyStage | null;
  now?: Date;
}

export interface RetrievedItem {
  id: string;
  propertyId: string;
  topic: string;
  bodyMd: string;
  locale: string;
  visibility: VisibilityLevel;
  journeyStage: JourneyStage | null;
  chunkType: ChunkType;
  entityType: EntityType;
  entityId: string | null;
  canonicalQuestion: string | null;
  contextPrefix: string;
  tags: string[];
  sourceFields: string[];
  bm25Score: number;
  vectorScore: number;
  rrfScore: number;
}

export interface RetrievalResult {
  items: RetrievedItem[];
  degraded: boolean;
  stats: {
    scopeSize: number;
    withEmbedding: number;
    bm25Hits: number;
    vectorHits: number;
  };
}

// ============================================================================
// Tunables
// ============================================================================

const RRF_K = 60;
const CANDIDATE_LIMIT = 100; // per channel (BM25 / vector) before fusion
const DEGRADED_THRESHOLD = 0.1; // if <10% of scope has an embedding → BM25 only

// ============================================================================
// Visibility helper
// ============================================================================

/**
 * Visibilities an audience is allowed to see. `sensitive` NEVER leaks into
 * assistant results regardless of audience — it exists only for operator
 * tooling and is never embedded.
 */
export function allowedVisibilitiesFor(
  audience: VisibilityLevel,
): VisibilityLevel[] {
  const cap = Math.min(VISIBILITY_ORDER[audience], VISIBILITY_ORDER.internal);
  return (Object.keys(VISIBILITY_ORDER) as VisibilityLevel[]).filter(
    (v) => v !== "sensitive" && VISIBILITY_ORDER[v] <= cap,
  );
}

// ============================================================================
// FTS query sanitizer
// ============================================================================

/**
 * Turn a user query into a Postgres `tsquery` literal for
 * `to_tsquery('simple', ...)`. Uses OR between tokens so we're forgiving; BM25
 * ranking sorts the best matches regardless.
 */
function buildTsQuery(query: string): string {
  const tokens = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `${t}:*`).join(" | ");
}

// ============================================================================
// pgvector helpers
// ============================================================================

export function toVectorLiteral(v: number[]): string {
  return `[${v.map((x) => (Number.isFinite(x) ? x.toString() : "0")).join(",")}]`;
}

// ============================================================================
// SQL row shape
// ============================================================================

interface ScoredRow {
  id: string;
  property_id: string;
  topic: string;
  body_md: string;
  locale: string;
  visibility: VisibilityLevel;
  journey_stage: JourneyStage | null;
  chunk_type: ChunkType;
  entity_type: EntityType;
  entity_id: string | null;
  canonical_question: string | null;
  context_prefix: string;
  tags: string[];
  source_fields: string[];
  score: number;
}

// ============================================================================
// Retriever
// ============================================================================

export async function hybridRetrieve(
  query: string,
  filters: HardFilters,
  opts: { topK?: number } = {},
): Promise<RetrievalResult> {
  const topK = opts.topK ?? 20;
  const now = filters.now ?? new Date();
  const allowedVis = allowedVisibilitiesFor(filters.audience);

  // Scope counts drive degraded-mode, BM25 is independent — run in parallel.
  const [scopeCounts, bm25] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint; with_embedding: bigint }>>`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "embedding" IS NOT NULL)::bigint AS with_embedding
      FROM "knowledge_items"
      WHERE "property_id" = ${filters.propertyId}
        AND "locale" = ${filters.locale}
        AND "visibility"::text = ANY(${allowedVis})
        AND ("valid_from" IS NULL OR "valid_from" <= ${now})
        AND ("valid_to"   IS NULL OR "valid_to"   >= ${now})
        ${journeyStageScopeClause(filters.journeyStage)}
    `,
    runBm25(query, filters, now, allowedVis),
  ]);
  const scopeSize = Number(scopeCounts[0]?.total ?? 0);
  const withEmbedding = Number(scopeCounts[0]?.with_embedding ?? 0);
  const embeddingCoverage = scopeSize === 0 ? 0 : withEmbedding / scopeSize;
  const degraded = scopeSize > 0 && embeddingCoverage < DEGRADED_THRESHOLD;

  if (scopeSize === 0) {
    return {
      items: [],
      degraded: false,
      stats: { scopeSize: 0, withEmbedding: 0, bm25Hits: 0, vectorHits: 0 },
    };
  }

  let vector: ScoredRow[] = [];
  if (!degraded && withEmbedding > 0) {
    try {
      vector = await runVector(query, filters, now, allowedVis);
    } catch (err) {
      // Embedding API is best-effort. Log and fall through to BM25-only.
      console.warn(
        `[assistant/retriever] vector channel failed; falling back to BM25: ${
          (err as Error).message
        }`,
      );
    }
  }

  const items = fuse(bm25, vector, topK);

  return {
    items,
    degraded,
    stats: {
      scopeSize,
      withEmbedding,
      bm25Hits: bm25.length,
      vectorHits: vector.length,
    },
  };
}

// ============================================================================
// BM25 channel
// ============================================================================

async function runBm25(
  query: string,
  filters: HardFilters,
  now: Date,
  allowedVis: VisibilityLevel[],
): Promise<ScoredRow[]> {
  const ts = buildTsQuery(query);
  if (!ts) return [];

  return prisma.$queryRaw<ScoredRow[]>`
    SELECT
      "id",
      "property_id",
      "topic",
      "body_md",
      "locale",
      "visibility",
      "journey_stage",
      "chunk_type",
      "entity_type",
      "entity_id",
      "canonical_question",
      "context_prefix",
      "tags",
      "source_fields",
      ts_rank("bm25_tsv", to_tsquery('simple', ${ts})) AS score
    FROM "knowledge_items"
    WHERE "property_id" = ${filters.propertyId}
      AND "locale" = ${filters.locale}
      AND "visibility"::text = ANY(${allowedVis})
      AND ("valid_from" IS NULL OR "valid_from" <= ${now})
      AND ("valid_to"   IS NULL OR "valid_to"   >= ${now})
      ${journeyStageScopeClause(filters.journeyStage)}
      AND "bm25_tsv" @@ to_tsquery('simple', ${ts})
    ORDER BY score DESC
    LIMIT ${CANDIDATE_LIMIT}
  `;
}

// ============================================================================
// Vector channel
// ============================================================================

async function runVector(
  query: string,
  filters: HardFilters,
  now: Date,
  allowedVis: VisibilityLevel[],
): Promise<ScoredRow[]> {
  const provider = resolveEmbeddingProvider();
  const [vec] = await provider.embed([query], { inputType: "query" });
  if (!vec) return [];
  const lit = toVectorLiteral(vec);

  return prisma.$queryRaw<ScoredRow[]>`
    SELECT
      "id",
      "property_id",
      "topic",
      "body_md",
      "locale",
      "visibility",
      "journey_stage",
      "chunk_type",
      "entity_type",
      "entity_id",
      "canonical_question",
      "context_prefix",
      "tags",
      "source_fields",
      1 - ("embedding" <=> ${lit}::vector) AS score
    FROM "knowledge_items"
    WHERE "property_id" = ${filters.propertyId}
      AND "locale" = ${filters.locale}
      AND "visibility"::text = ANY(${allowedVis})
      AND "embedding" IS NOT NULL
      AND ("valid_from" IS NULL OR "valid_from" <= ${now})
      AND ("valid_to"   IS NULL OR "valid_to"   >= ${now})
      ${journeyStageScopeClause(filters.journeyStage)}
    ORDER BY "embedding" <=> ${lit}::vector
    LIMIT ${CANDIDATE_LIMIT}
  `;
}

// ============================================================================
// journeyStage pushdown
// ============================================================================

/**
 * Pushdown for the journey-stage filter. The intent resolver passes the stage
 * only when it is confident (≥0.7); below that it leaves the filter off and
 * we keep the whole scope. `any` always matches, as does NULL (legacy rows).
 */
function journeyStageScopeClause(
  stage: JourneyStage | null | undefined,
): Prisma.Sql {
  if (!stage) return Prisma.empty;
  return Prisma.sql`AND ("journey_stage" = ${stage} OR "journey_stage" = 'any' OR "journey_stage" IS NULL)`;
}

// ============================================================================
// Reciprocal Rank Fusion
// ============================================================================

export const __retriever_internal = {
  buildTsQuery,
  fuse,
  RRF_K,
  CANDIDATE_LIMIT,
  DEGRADED_THRESHOLD,
};

function fuse(
  bm25: ScoredRow[],
  vector: ScoredRow[],
  topK: number,
): RetrievedItem[] {
  const bucket = new Map<string, {
    row: ScoredRow;
    bm25Score: number;
    vectorScore: number;
    rrf: number;
  }>();

  const addChannel = (rows: ScoredRow[], channel: "bm25" | "vector") => {
    for (let rank = 0; rank < rows.length; rank += 1) {
      const row = rows[rank];
      const contribution = 1 / (RRF_K + rank + 1);
      const current = bucket.get(row.id);
      if (current) {
        current.rrf += contribution;
        if (channel === "bm25") current.bm25Score = Math.max(current.bm25Score, row.score);
        else current.vectorScore = Math.max(current.vectorScore, row.score);
      } else {
        bucket.set(row.id, {
          row,
          bm25Score: channel === "bm25" ? row.score : 0,
          vectorScore: channel === "vector" ? row.score : 0,
          rrf: contribution,
        });
      }
    }
  };

  addChannel(bm25, "bm25");
  addChannel(vector, "vector");

  const fused = Array.from(bucket.values())
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topK);

  return fused.map(({ row, bm25Score, vectorScore, rrf }) => ({
    id: row.id,
    propertyId: row.property_id,
    topic: row.topic,
    bodyMd: row.body_md,
    locale: row.locale,
    visibility: row.visibility,
    journeyStage: row.journey_stage,
    chunkType: row.chunk_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    canonicalQuestion: row.canonical_question,
    contextPrefix: row.context_prefix,
    tags: row.tags ?? [],
    sourceFields: row.source_fields ?? [],
    bm25Score,
    vectorScore,
    rrfScore: rrf,
  }));
}
