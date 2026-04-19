-- Rama 11B: i18n layer for knowledge items.
--
-- Adds two columns introduced by `feat/knowledge-i18n`:
--   1. `properties.default_locale`  — per-property default locale (maps to
--      Prisma `Property.defaultLocale String @default("es")`). Drives UI
--      default locale, manual item creation locale, and regeneration target.
--   2. `knowledge_items.template_key` — stable semantic key for autoextract
--      chunks. Enables cross-locale pairing by
--      (propertyId, entityType, entityId, templateKey) instead of row id.
--      NULL for manual items (excluded from cross-locale tracking).
--
-- Also adds the composite index that supports the new identity-based
-- lookups in `getItemForLocale` / `listMissingTranslations`.
--
-- These columns + index had been applied to local dev databases via
-- `prisma db push` during branch development; this migration captures the
-- change so deployments (`prisma migrate deploy`) converge the same state.
-- The `IF NOT EXISTS` guards make the migration idempotent against any
-- environment that already has these objects from a prior `db push`.

ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "default_locale" TEXT NOT NULL DEFAULT 'es';

ALTER TABLE "knowledge_items"
  ADD COLUMN IF NOT EXISTS "template_key" TEXT;

CREATE INDEX IF NOT EXISTS "knowledge_items_property_id_entity_type_entity_id_template__idx"
  ON "knowledge_items" ("property_id", "entity_type", "entity_id", "template_key", "locale");
