-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "role_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL DEFAULT 'person',
    "display_name" TEXT NOT NULL,
    "contact_person_name" TEXT,
    "phone" TEXT,
    "phone_secondary" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "availability_schedule" TEXT,
    "emergency_available" BOOLEAN NOT NULL DEFAULT false,
    "has_property_access" BOOLEAN NOT NULL DEFAULT false,
    "internal_notes" TEXT,
    "guest_visible_notes" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_property_id_idx" ON "contacts"("property_id");

-- CreateIndex
CREATE INDEX "contacts_property_id_role_key_idx" ON "contacts"("property_id", "role_key");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate host data from properties to contacts
INSERT INTO "contacts" ("id", "property_id", "role_key", "entity_type", "display_name", "phone", "visibility", "is_primary", "updated_at")
SELECT
    gen_random_uuid()::text,
    p."id",
    'ct.host',
    'person',
    COALESCE(p."host_name", 'Anfitrión'),
    p."host_contact_phone",
    'guest',
    true,
    NOW()
FROM "properties" p
WHERE p."host_name" IS NOT NULL OR p."host_contact_phone" IS NOT NULL;

-- Drop migrated columns from properties
ALTER TABLE "properties" DROP COLUMN "host_contact_phone";
ALTER TABLE "properties" DROP COLUMN "host_name";
ALTER TABLE "properties" DROP COLUMN "support_contact";
