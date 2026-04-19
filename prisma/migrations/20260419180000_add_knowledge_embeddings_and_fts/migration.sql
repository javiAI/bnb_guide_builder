-- Rama 11C: embeddings + Postgres FTS for knowledge_items.
--
-- Adds the retrieval substrate for the assistant pipeline (hybrid BM25 +
-- vector). Knowingly avoids ANN (IVFFlat/HNSW) indexes for now: property-
-- scoped corpora stay under ~2k items in the foreseeable future, and a
-- sequential scan filtered by `(property_id, locale, visibility)` is
-- fast enough. Re-evaluate when a single property grows past ~2k items or
-- when cross-property retrieval patterns appear (see docs/DATA_MODEL.md).
--
-- Adds:
--   • pgvector extension (idempotent).
--   • `knowledge_items.embedding          vector(512)`   — Voyage voyage-3-lite output dim.
--   • `knowledge_items.embedding_model    text`          — provider+model string (e.g. "voyage:voyage-3-lite").
--   • `knowledge_items.embedding_version  int DEFAULT 1` — bumps when prefix strategy or model family changes.
--   • `knowledge_items.bm25_tsv`          — generated tsvector over bm25_text (simple config).
--   • GIN index over `bm25_tsv` for FTS.
--   • Partial btree over (property_id, locale, visibility) WHERE embedding IS NOT NULL
--     to help the vector-side seq scan stay bounded as backfill progresses.
--
-- Deployment notes:
--   • Requires pgvector installed on the target DB. Supabase/Neon preinstall
--     it; self-hosted Postgres needs `CREATE EXTENSION vector` by a
--     superuser at least once per database — CREATE EXTENSION IF NOT EXISTS
--     below is a no-op when already present.
--   • Generated columns require Postgres ≥ 12 (we target 14+).
--   • No ANN index in this migration on purpose. Do not add one without
--     benchmarking against the current seq scan on representative data.

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable: embedding + model + version
ALTER TABLE "knowledge_items"
  ADD COLUMN "embedding"         vector(512),
  ADD COLUMN "embedding_model"   TEXT,
  ADD COLUMN "embedding_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: generated tsvector column for BM25
-- `simple` config on purpose — bm25_text is already locale-normalized
-- upstream (Rama 11A) and we do not want Postgres stemming to override it.
ALTER TABLE "knowledge_items"
  ADD COLUMN "bm25_tsv" tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce("bm25_text", ''))) STORED;

-- CreateIndex: GIN on bm25_tsv for full-text search
CREATE INDEX "knowledge_items_bm25_tsv_idx"
  ON "knowledge_items" USING GIN ("bm25_tsv");

-- CreateIndex: partial btree to bound vector seq scan to already-embedded rows
CREATE INDEX "knowledge_items_property_locale_visibility_embedded_idx"
  ON "knowledge_items" ("property_id", "locale", "visibility")
  WHERE "embedding" IS NOT NULL;
