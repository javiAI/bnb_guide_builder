-- 16E.6 — two-layer arrival cockpit (S02 intercity).
--
-- The unified "Cómo llegar" cockpit surfaces the intercity layer: how the
-- guest reaches the city — parking (car), airport, train, bus. The 4
-- chip-toggle bar at the top of the cockpit writes to
-- `arrival_modes_enabled_json` with shape:
--   Partial<Record<"parking"|"train"|"bus"|"airport", boolean>>
--
-- Nullable — absent = defaults (parking follows hasParking; other intercity
-- modes default off).

ALTER TABLE "properties"
  ADD COLUMN "arrival_modes_enabled_json" JSONB;
