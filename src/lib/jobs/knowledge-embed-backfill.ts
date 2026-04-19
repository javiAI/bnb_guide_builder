#!/usr/bin/env tsx
/**
 * Knowledge embedding backfill.
 *
 * Idempotent batch job that computes vectors for every KnowledgeItem missing
 * an embedding (or carrying a stale modelId/version after a provider bump).
 * Selection is raw SQL because Prisma does not expose the pgvector column.
 *
 * Manual invocation only (MVP). No cron, no webhook. Run after:
 *   - seeding a new property,
 *   - a locale backfill,
 *   - changing the active embedding provider or version.
 *
 * Usage:
 *   npm run embed:backfill                          # backfill all missing
 *   npm run embed:backfill -- --property <id>       # scope to one property
 *   npm run embed:backfill -- --batch 32            # override batch size
 *   npm run embed:backfill -- --dry-run             # count only
 */

import { prisma } from "@/lib/db";
import {
  resolveEmbeddingProvider,
  type EmbeddingProvider,
} from "@/lib/services/assistant/embeddings.service";
import { toVectorLiteral } from "@/lib/services/assistant/retriever";

const DEFAULT_BATCH = 64;

type Row = {
  id: string;
  context_prefix: string;
  body_md: string;
};

interface Args {
  propertyId: string | null;
  batchSize: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  let propertyId: string | null = null;
  let batchSize = DEFAULT_BATCH;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--property" || a === "-p") propertyId = argv[++i] ?? null;
    else if (a === "--batch" || a === "-b") batchSize = Math.max(1, Number(argv[++i]) || DEFAULT_BATCH);
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: embed:backfill [--property <id>] [--batch N] [--dry-run]");
      process.exit(0);
    }
  }
  return { propertyId, batchSize, dryRun };
}

async function countMissing(
  propertyId: string | null,
  provider: EmbeddingProvider,
): Promise<number> {
  const rows = propertyId
    ? await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "knowledge_items"
        WHERE "property_id" = ${propertyId}
          AND (
            "embedding" IS NULL
            OR "embedding_model" IS DISTINCT FROM ${provider.modelId}
            OR "embedding_version" IS DISTINCT FROM ${provider.version}
          )
      `
    : await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "knowledge_items"
        WHERE
          "embedding" IS NULL
          OR "embedding_model" IS DISTINCT FROM ${provider.modelId}
          OR "embedding_version" IS DISTINCT FROM ${provider.version}
      `;
  return Number(rows[0]?.count ?? 0);
}

async function fetchBatch(
  propertyId: string | null,
  provider: EmbeddingProvider,
  limit: number,
): Promise<Row[]> {
  if (propertyId) {
    return prisma.$queryRaw<Row[]>`
      SELECT "id", "context_prefix", "body_md"
      FROM "knowledge_items"
      WHERE "property_id" = ${propertyId}
        AND (
          "embedding" IS NULL
          OR "embedding_model" IS DISTINCT FROM ${provider.modelId}
          OR "embedding_version" IS DISTINCT FROM ${provider.version}
        )
      ORDER BY "updated_at" ASC
      LIMIT ${limit}
    `;
  }
  return prisma.$queryRaw<Row[]>`
    SELECT "id", "context_prefix", "body_md"
    FROM "knowledge_items"
    WHERE
      "embedding" IS NULL
      OR "embedding_model" IS DISTINCT FROM ${provider.modelId}
      OR "embedding_version" IS DISTINCT FROM ${provider.version}
    ORDER BY "updated_at" ASC
    LIMIT ${limit}
  `;
}

async function writeEmbedding(
  id: string,
  vector: number[],
  provider: EmbeddingProvider,
): Promise<void> {
  const lit = toVectorLiteral(vector);
  await prisma.$executeRaw`
    UPDATE "knowledge_items"
    SET
      "embedding"         = ${lit}::vector,
      "embedding_model"   = ${provider.modelId},
      "embedding_version" = ${provider.version},
      "updated_at"        = NOW()
    WHERE "id" = ${id}
  `;
}

async function processBatch(
  rows: Row[],
  provider: EmbeddingProvider,
): Promise<void> {
  // Document-side: embed the prefix + body together (contextual retrieval).
  const inputs = rows.map((r) => `${r.context_prefix}\n${r.body_md}`);
  const vectors = await provider.embed(inputs, { inputType: "document" });
  if (vectors.length !== rows.length) {
    throw new Error(
      `[embed:backfill] provider returned ${vectors.length} vectors for ${rows.length} rows`,
    );
  }
  await Promise.all(
    rows.map((row, i) => writeEmbedding(row.id, vectors[i], provider)),
  );
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const provider = resolveEmbeddingProvider();

  const total = await countMissing(args.propertyId, provider);
  console.log(
    `[embed:backfill] provider=${provider.modelId} version=${provider.version} ` +
      `scope=${args.propertyId ?? "ALL"} pending=${total} batch=${args.batchSize}` +
      (args.dryRun ? " DRY-RUN" : ""),
  );
  if (args.dryRun || total === 0) {
    await prisma.$disconnect();
    return;
  }

  let done = 0;
  for (;;) {
    const batch = await fetchBatch(args.propertyId, provider, args.batchSize);
    if (batch.length === 0) break;
    try {
      await processBatch(batch, provider);
    } catch (err) {
      console.error(`[embed:backfill] batch failed (${batch.length} rows):`, err);
      throw err;
    }
    done += batch.length;
    console.log(`[embed:backfill] ${done}/${total} embedded`);
  }
  console.log(`[embed:backfill] done — ${done} rows`);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("[embed:backfill] fatal:", err);
  process.exit(1);
});
