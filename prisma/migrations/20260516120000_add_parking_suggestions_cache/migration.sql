-- 16E.6 — persist parking discovery suggestions per property.
--
-- The cockpit's "Sugeridos" column previously recomputed via a client-triggered
-- search action on every visit (and discarded the result on navigation). The
-- MapTiler upstream is deterministic at a snapshot in time, so we cache the
-- last discovery payload on the property row and serve it on first paint. The
-- cache is invalidated (NULLed) when the property's coords change; the
-- operator can also refresh on demand from the cockpit.
--
-- `parking_suggestions_cache_json` holds an array of `ParkingSuggestion` JSON
-- objects (provider, providerPlaceId, name, lat/lng, address, distance, etc.).
-- `parking_suggestions_cached_at` is informational — useful for diagnostics
-- and for a future TTL-based refresh policy.

ALTER TABLE "properties"
  ADD COLUMN "parking_suggestions_cache_json" JSONB,
  ADD COLUMN "parking_suggestions_cached_at" TIMESTAMP(3);
