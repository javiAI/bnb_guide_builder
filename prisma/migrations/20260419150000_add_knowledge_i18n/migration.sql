-- Rama 11B: i18n layer for knowledge items.
--
-- Adds:
--   • `properties.default_locale`  — per-property default locale (maps to
--     Prisma `Property.defaultLocale String @default("es")`). Drives UI
--     default locale, manual item creation locale, and regeneration target.
--   • `knowledge_items.template_key` — stable semantic key for autoextract
--     chunks. Enables cross-locale pairing by
--     `(propertyId, entityType, entityId, templateKey)` instead of row id.
--     NULL for manual items (excluded from cross-locale tracking).
--   • Composite index supporting `getItemForLocale` /
--     `listMissingTranslations` lookups.
--
-- Deployment notes:
--   • Empty DB: `prisma migrate deploy` applies this after
--     `20260418000000_backfill_autoextract_and_drift`.
--   • Dev DBs that already have these columns from `prisma db push` must
--     mark this migration as applied with
--     `prisma migrate resolve --applied 20260419150000_add_knowledge_i18n`
--     — do NOT re-run the SQL.

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "default_locale" TEXT NOT NULL DEFAULT 'es';

-- AlterTable
ALTER TABLE "knowledge_items" ADD COLUMN     "template_key" TEXT;

-- CreateIndex
CREATE INDEX "knowledge_items_property_id_entity_type_entity_id_template__idx" ON "knowledge_items"("property_id", "entity_type", "entity_id", "template_key", "locale");
