-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "has_building_access" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "host_name" TEXT,
ADD COLUMN     "infants_allowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_autonomous_checkin" BOOLEAN NOT NULL DEFAULT false;
