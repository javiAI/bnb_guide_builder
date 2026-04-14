-- CreateTable: property_amenity_instances
CREATE TABLE "property_amenity_instances" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "amenity_key" TEXT NOT NULL,
    "instance_key" TEXT NOT NULL DEFAULT 'default',
    "subtype_key" TEXT,
    "details_json" JSONB,
    "guest_instructions" TEXT,
    "ai_instructions" TEXT,
    "internal_notes" TEXT,
    "troubleshooting_notes" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_amenity_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable: property_amenity_placements
CREATE TABLE "property_amenity_placements" (
    "id" TEXT NOT NULL,
    "amenity_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_amenity_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "property_amenity_instances_property_id_amenity_key_instance_key_key" ON "property_amenity_instances"("property_id", "amenity_key", "instance_key");
CREATE INDEX "property_amenity_instances_property_id_idx" ON "property_amenity_instances"("property_id");
CREATE INDEX "property_amenity_instances_property_id_amenity_key_idx" ON "property_amenity_instances"("property_id", "amenity_key");

CREATE UNIQUE INDEX "property_amenity_placements_amenity_id_space_id_key" ON "property_amenity_placements"("amenity_id", "space_id");
CREATE INDEX "property_amenity_placements_amenity_id_idx" ON "property_amenity_placements"("amenity_id");
CREATE INDEX "property_amenity_placements_space_id_idx" ON "property_amenity_placements"("space_id");

-- AddForeignKey
ALTER TABLE "property_amenity_instances" ADD CONSTRAINT "property_amenity_instances_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_amenity_placements" ADD CONSTRAINT "property_amenity_placements_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "property_amenity_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_amenity_placements" ADD CONSTRAINT "property_amenity_placements_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
