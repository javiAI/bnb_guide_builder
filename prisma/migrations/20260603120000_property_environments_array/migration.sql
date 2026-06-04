-- Property environment becomes multi-valued: a property can be e.g.
-- mountain + ski + rural at once. Single scalar `property_environment` →
-- `property_environments` (text[]).
--
-- Add the array column with the Prisma String[] contract (NOT NULL + empty
-- array default — never NULL), backfill the old scalar into a one-element array,
-- then drop the old column. Add-backfill-drop (not drop-first) preserves data.
ALTER TABLE "properties" ADD COLUMN "property_environments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "properties" SET "property_environments" = ARRAY["property_environment"] WHERE "property_environment" IS NOT NULL;
ALTER TABLE "properties" DROP COLUMN "property_environment";
