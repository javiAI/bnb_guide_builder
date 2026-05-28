-- 16E.6 — arrival cockpit mode toggles ("Cómo llegar" S02).
--
-- The unified "Cómo llegar" cockpit surfaces per-mode enable flags. The chip
-- bar at the top of the cockpit writes to `arrival_modes_enabled_json`. Keys:
--   "parking" + every key in `ARRIVAL_MODES` (see `arrival-discovery.service.ts`
--    — the source of truth) — intercity-only: train/bus/airport. Last-mile
--    (metro/urban_bus/taxi/walk) is delegated to the directional Maps deep
--    link from the arrival point to the property — no per-mode toggles.
-- Shape: Partial<Record<key, boolean>>.
--
-- Nullable — absent = defaults (parking follows hasParking; transit modes
-- default off).

ALTER TABLE "properties"
  ADD COLUMN "arrival_modes_enabled_json" JSONB;
