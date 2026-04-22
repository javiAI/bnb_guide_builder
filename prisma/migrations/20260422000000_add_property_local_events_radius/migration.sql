-- Rama 13C: per-property configurable event-search radius.
-- Backs `Property.localEventsRadiusKm` used by PHQ/Ticketmaster as the
-- upstream geo radius and by Firecrawl as a widening factor for curated
-- source applicability. Default 25 km matches prior constructor defaults.

ALTER TABLE "properties"
  ADD COLUMN "local_events_radius_km" INTEGER NOT NULL DEFAULT 25;
