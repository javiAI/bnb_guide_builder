-- Rama 13D — Incident-from-guest reporter fields + composite index.
--
-- Adds the columns the guest-guide issue reporter relies on:
--   - origin: "internal" | "guest_guide" (drives notification + visibility paths)
--   - reporter_type: "host" | "guest"
--   - category_key: taxonomy id from `incident_categories.json` (ic.*)
--   - guest_contact_optional: opt-in guest handle for host follow-up
--
-- Safe defaults ("internal" / "host") so existing rows remain valid without
-- backfill. NULLs on `category_key` / `guest_contact_optional` are the intended
-- state for legacy rows — those are internal operations entries that predate
-- the guest flow.
--
-- The (property_id, origin, status) composite index powers the host panel's
-- default filter ("open, from guest") without scanning every incident row.

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "category_key" TEXT,
ADD COLUMN     "guest_contact_optional" TEXT,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'internal',
ADD COLUMN     "reporter_type" TEXT NOT NULL DEFAULT 'host';

-- CreateIndex
CREATE INDEX "incidents_property_id_origin_status_idx" ON "incidents"("property_id", "origin", "status");
