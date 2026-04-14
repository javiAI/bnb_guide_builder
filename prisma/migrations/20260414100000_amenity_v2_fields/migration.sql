-- AlterTable: add details_json column
ALTER TABLE "property_amenities" ADD COLUMN "details_json" JSONB;

-- CreateIndex: space_id lookup
CREATE INDEX "property_amenities_space_id_idx" ON "property_amenities"("space_id");

-- CreateIndex: compound unique (property_id, amenity_key, space_id)
-- NULLS NOT DISTINCT ensures (propA, amenityX, NULL) is treated as a duplicate
CREATE UNIQUE INDEX "property_amenities_property_id_amenity_key_space_id_key" ON "property_amenities"("property_id", "amenity_key", "space_id") NULLS NOT DISTINCT;

-- AddForeignKey: space_id → spaces(id) cascade
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
