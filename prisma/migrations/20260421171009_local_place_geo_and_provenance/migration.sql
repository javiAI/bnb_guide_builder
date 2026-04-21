-- Rama 13A: add geo + provider provenance to local_places so host-picked
-- POIs carry lat/lng, address, website, and a source-of-truth fingerprint
-- (`provider`, `provider_place_id`). The provider_metadata JSON column stores
-- the sanitized reduced payload produced by the POI provider (nativeCategory,
-- placeTypes[], confidence, retrievedAt) — not the raw provider response.
-- Legacy rows with unprefixed `category_key` values are migrated to their
-- canonical `lp.<slug>` key so the taxonomy loader (fail-loud on boot)
-- accepts every stored value.

-- AlterTable
ALTER TABLE "local_places"
  ADD COLUMN "latitude"           DOUBLE PRECISION,
  ADD COLUMN "longitude"          DOUBLE PRECISION,
  ADD COLUMN "address"            TEXT,
  ADD COLUMN "website"            TEXT,
  ADD COLUMN "provider"           TEXT,
  ADD COLUMN "provider_place_id"  TEXT,
  ADD COLUMN "provider_metadata"  JSONB;

-- Backfill legacy unprefixed category keys → `lp.<key>`. Any remaining
-- non-lp.* value gets parked under `lp.other` so boot never sees a raw
-- taxonomy key (covers typos/forgotten entries from dev).
UPDATE "local_places"
SET "category_key" = CASE "category_key"
  WHEN 'restaurant'  THEN 'lp.restaurant'
  WHEN 'cafe'        THEN 'lp.cafe'
  WHEN 'bar'         THEN 'lp.bar'
  WHEN 'supermarket' THEN 'lp.supermarket'
  WHEN 'pharmacy'    THEN 'lp.pharmacy'
  WHEN 'hospital'    THEN 'lp.hospital'
  WHEN 'transport'   THEN 'lp.transport'
  WHEN 'parking'     THEN 'lp.parking'
  WHEN 'attraction'  THEN 'lp.attraction'
  WHEN 'beach'       THEN 'lp.beach'
  WHEN 'park'        THEN 'lp.park'
  WHEN 'gym'         THEN 'lp.gym'
  WHEN 'laundry'     THEN 'lp.laundry'
  WHEN 'other'       THEN 'lp.other'
  ELSE 'lp.other'
END
WHERE "category_key" NOT LIKE 'lp.%';

-- Unique composite on (propertyId, provider, providerPlaceId). Postgres
-- treats NULLs as distinct in unique indexes by default, so manual rows
-- (provider/providerPlaceId both NULL) never conflict with each other —
-- only provider-anchored rows get deduped. Prisma-declared @@unique so
-- `prisma migrate diff` stays clean.
CREATE UNIQUE INDEX "local_places_property_provider_place_unique"
  ON "local_places" ("property_id", "provider", "provider_place_id");
