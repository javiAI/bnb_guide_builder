-- AlterTable: add infrastructureJson to Property
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "infrastructure_json" JSONB;

-- AlterTable: add configJson to BedConfiguration
ALTER TABLE "bed_configurations" ADD COLUMN IF NOT EXISTS "config_json" JSONB;
