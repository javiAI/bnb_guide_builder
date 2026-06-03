-- Property environment becomes multi-valued: a property can be e.g.
-- mountain + ski + rural at once. Single scalar `property_environment` →
-- `property_environments` (text[]). Sparse data; drop is acceptable in dev.
ALTER TABLE "properties" DROP COLUMN "property_environment";
ALTER TABLE "properties" ADD COLUMN "property_environments" TEXT[];
