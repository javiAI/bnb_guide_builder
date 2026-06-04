-- "Otro" entorno becomes multi-valued (the operator can add several custom
-- environments in the multiselect). Single label → array of labels.
--
-- Add the array column with the Prisma String[] contract (NOT NULL + empty
-- array default — never NULL), backfill the old single label into a one-element
-- array (when present), then drop the old column. Add-backfill-drop preserves data.
ALTER TABLE "properties" ADD COLUMN "custom_environment_labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "properties" SET "custom_environment_labels" = ARRAY["custom_environment_label"] WHERE "custom_environment_label" IS NOT NULL AND "custom_environment_label" <> '';
ALTER TABLE "properties" DROP COLUMN "custom_environment_label";
