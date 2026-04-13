-- AlterTable: add infrastructureJson to Property
ALTER TABLE "properties" ADD COLUMN "infrastructure_json" JSONB;

-- AlterTable: add configJson to BedConfiguration
ALTER TABLE "bed_configurations" ADD COLUMN "config_json" JSONB;
