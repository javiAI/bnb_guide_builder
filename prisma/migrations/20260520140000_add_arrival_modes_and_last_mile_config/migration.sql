-- 16E.6 — arrival cockpit mode toggles ("Cómo llegar" S02 + last-mile).
--
-- The unified "Cómo llegar" cockpit surfaces per-mode enable flags. The chip
-- bar at the top of the cockpit writes to `arrival_modes_enabled_json`. Keys:
--   "parking" + every key in `ARRIVAL_MODES` (see `arrival-discovery.service.ts`
--    — the source of truth) — currently intercity (train/bus/airport) plus
--    last-mile (metro/urban_bus/taxi).
-- Shape: Partial<Record<key, boolean>>.
--
-- Nullable — absent = defaults (parking follows hasParking; transit modes
-- default off).

ALTER TABLE "properties"
  ADD COLUMN "arrival_modes_enabled_json" JSONB;
