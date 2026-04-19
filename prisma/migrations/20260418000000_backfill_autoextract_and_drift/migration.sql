-- Backfill migration for schema drift that accumulated between
-- `20260415120000_drop_property_amenity` (2026-04-15) and the start of
-- Rama 11B (2026-04-19). Covers:
--   • Rama 11A (`feat/knowledge-autoextract`, commit ceb56ef) — knowledge
--     auto-extract schema (locale, chunk_type, entity_type/id, bm25_text,
--     canonical_question, context_prefix, content_hash, source_fields,
--     tags, tokens, valid_from/to, is_auto_extracted; visibility enum
--     migration; new `incidents` table; supporting indexes).
--   • Earlier unmigrated branches that only ran `prisma db push`:
--     VisibilityLevel enum, property_derived, property_systems +
--     coverages, tree_json/schema_version on guide_versions, public_slug
--     + brand_* on properties, wizard_seed_key on spaces / bed_configs,
--     media_assets.content_hash/blurhash/size_bytes, troubleshooting
--     linking columns, guide_sections/items drop.
--
-- Generated deterministically via:
--   `prisma migrate diff --from-migrations prisma/migrations \
--       --to-schema-datamodel prisma/schema.prisma --script`
-- (run with Rama 11B columns temporarily removed from the schema so this
--  migration ends exactly at the 11A state; Rama 11B then lives in
--  `20260419150000_add_knowledge_i18n`).
--
-- Deployment notes:
--   • Empty DB: `prisma migrate deploy` applies the whole chain linearly.
--   • Dev DBs already sync'd via `db push` from earlier branches must
--     mark this migration (and the historical ones it represents) as
--     applied with `prisma migrate resolve --applied <name>` — do NOT
--     re-run the SQL; it would fail on pre-existing objects.

-- CreateEnum
CREATE TYPE "VisibilityLevel" AS ENUM ('guest', 'ai', 'internal', 'sensitive');

-- DropForeignKey
ALTER TABLE "guide_section_items" DROP CONSTRAINT "guide_section_items_guide_section_id_fkey";

-- DropForeignKey
ALTER TABLE "guide_sections" DROP CONSTRAINT "guide_sections_guide_version_id_fkey";

-- DropIndex
DROP INDEX "guide_versions_property_id_idx";

-- DropIndex
DROP INDEX "knowledge_items_property_id_journey_stage_idx";

-- DropIndex
DROP INDEX "knowledge_items_property_id_visibility_language_idx";

-- AlterTable
ALTER TABLE "bed_configurations" ADD COLUMN     "wizard_seed_key" TEXT;

-- AlterTable
ALTER TABLE "contacts" DROP COLUMN "visibility",
ADD COLUMN     "visibility" "VisibilityLevel" NOT NULL DEFAULT 'internal',
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "guide_versions" ADD COLUMN     "tree_json" JSONB,
ADD COLUMN     "tree_schema_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "knowledge_items" DROP COLUMN "language",
ADD COLUMN     "bm25_text" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "canonical_question" TEXT,
ADD COLUMN     "chunk_type" TEXT NOT NULL DEFAULT 'fact',
ADD COLUMN     "content_hash" TEXT,
ADD COLUMN     "context_prefix" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "entity_type" TEXT NOT NULL DEFAULT 'property',
ADD COLUMN     "is_auto_extracted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN     "source_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "valid_from" TIMESTAMP(3),
ADD COLUMN     "valid_to" TIMESTAMP(3),
DROP COLUMN "visibility",
ADD COLUMN     "visibility" "VisibilityLevel" NOT NULL DEFAULT 'guest',
ALTER COLUMN "confidence_score" SET NOT NULL,
ALTER COLUMN "confidence_score" SET DEFAULT 0.5;

-- AlterTable
ALTER TABLE "local_places" DROP COLUMN "visibility",
ADD COLUMN     "visibility" "VisibilityLevel" NOT NULL DEFAULT 'guest';

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "blurhash" TEXT,
ADD COLUMN     "content_hash" TEXT,
ADD COLUMN     "size_bytes" INTEGER,
DROP COLUMN "visibility",
ADD COLUMN     "visibility" "VisibilityLevel" NOT NULL DEFAULT 'guest';

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "brand_logo_url" TEXT,
ADD COLUMN     "brand_palette_key" TEXT,
ADD COLUMN     "has_private_entrance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "public_slug" TEXT,
ALTER COLUMN "layout_key" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "property_amenity_instances" ADD COLUMN     "runbook_json" JSONB,
DROP COLUMN "visibility",
ADD COLUMN     "visibility" "VisibilityLevel" NOT NULL DEFAULT 'guest';

-- AlterTable
ALTER TABLE "spaces" ADD COLUMN     "created_by" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "wizard_seed_key" TEXT,
DROP COLUMN "visibility",
ADD COLUMN     "visibility" "VisibilityLevel" NOT NULL DEFAULT 'guest';

-- AlterTable
ALTER TABLE "troubleshooting_playbooks" ADD COLUMN     "access_method_key" TEXT,
ADD COLUMN     "amenity_key" TEXT,
ADD COLUMN     "space_id" TEXT,
ADD COLUMN     "system_key" TEXT,
DROP COLUMN "visibility",
ADD COLUMN     "visibility" "VisibilityLevel" NOT NULL DEFAULT 'guest';

-- DropTable
DROP TABLE "guide_section_items";

-- DropTable
DROP TABLE "guide_sections";

-- CreateTable
CREATE TABLE "property_derived" (
    "property_id" TEXT NOT NULL,
    "derived_json" JSONB NOT NULL,
    "recomputed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_derived_pkey" PRIMARY KEY ("property_id")
);

-- CreateTable
CREATE TABLE "property_systems" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "system_key" TEXT NOT NULL,
    "details_json" JSONB,
    "ops_json" JSONB,
    "internal_notes" TEXT,
    "visibility" "VisibilityLevel" NOT NULL DEFAULT 'guest',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_system_coverages" (
    "id" TEXT NOT NULL,
    "system_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'inherited',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_system_coverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "playbook_id" TEXT,
    "notes" TEXT,
    "visibility" "VisibilityLevel" NOT NULL DEFAULT 'internal',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_systems_property_id_idx" ON "property_systems"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_systems_property_id_system_key_key" ON "property_systems"("property_id", "system_key");

-- CreateIndex
CREATE INDEX "property_system_coverages_system_id_idx" ON "property_system_coverages"("system_id");

-- CreateIndex
CREATE INDEX "property_system_coverages_space_id_idx" ON "property_system_coverages"("space_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_system_coverages_system_id_space_id_key" ON "property_system_coverages"("system_id", "space_id");

-- CreateIndex
CREATE INDEX "incidents_property_id_idx" ON "incidents"("property_id");

-- CreateIndex
CREATE INDEX "incidents_property_id_status_idx" ON "incidents"("property_id", "status");

-- CreateIndex
CREATE INDEX "incidents_property_id_target_type_target_id_idx" ON "incidents"("property_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "incidents_playbook_id_idx" ON "incidents"("playbook_id");

-- CreateIndex
CREATE UNIQUE INDEX "bed_configurations_space_id_wizard_seed_key_key" ON "bed_configurations"("space_id", "wizard_seed_key");

-- CreateIndex
CREATE UNIQUE INDEX "guide_versions_property_id_version_key" ON "guide_versions"("property_id", "version");

-- CreateIndex
CREATE INDEX "knowledge_items_property_id_locale_visibility_idx" ON "knowledge_items"("property_id", "locale", "visibility");

-- CreateIndex
CREATE INDEX "knowledge_items_property_id_locale_journey_stage_idx" ON "knowledge_items"("property_id", "locale", "journey_stage");

-- CreateIndex
CREATE INDEX "knowledge_items_property_id_chunk_type_idx" ON "knowledge_items"("property_id", "chunk_type");

-- CreateIndex
CREATE INDEX "knowledge_items_property_id_entity_type_entity_id_idx" ON "knowledge_items"("property_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "knowledge_items_property_id_visibility_idx" ON "knowledge_items"("property_id", "visibility");

-- CreateIndex
CREATE INDEX "media_assets_property_id_visibility_status_idx" ON "media_assets"("property_id", "visibility", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_assignments_media_asset_id_entity_type_entity_id_key" ON "media_assignments"("media_asset_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "properties_public_slug_key" ON "properties"("public_slug");

-- CreateIndex
CREATE INDEX "spaces_property_id_visibility_idx" ON "spaces"("property_id", "visibility");

-- CreateIndex
CREATE INDEX "spaces_property_id_status_idx" ON "spaces"("property_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "spaces_property_id_wizard_seed_key_key" ON "spaces"("property_id", "wizard_seed_key");

-- CreateIndex
CREATE INDEX "troubleshooting_playbooks_property_id_system_key_idx" ON "troubleshooting_playbooks"("property_id", "system_key");

-- CreateIndex
CREATE INDEX "troubleshooting_playbooks_property_id_amenity_key_idx" ON "troubleshooting_playbooks"("property_id", "amenity_key");

-- CreateIndex
CREATE INDEX "troubleshooting_playbooks_space_id_idx" ON "troubleshooting_playbooks"("space_id");

-- CreateIndex
CREATE INDEX "troubleshooting_playbooks_property_id_access_method_key_idx" ON "troubleshooting_playbooks"("property_id", "access_method_key");

-- AddForeignKey
ALTER TABLE "property_derived" ADD CONSTRAINT "property_derived_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_systems" ADD CONSTRAINT "property_systems_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_system_coverages" ADD CONSTRAINT "property_system_coverages_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "property_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_system_coverages" ADD CONSTRAINT "property_system_coverages_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "troubleshooting_playbooks" ADD CONSTRAINT "troubleshooting_playbooks_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "troubleshooting_playbooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

