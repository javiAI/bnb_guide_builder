-- 16E.6 — persist arrival-mode discovery suggestions per property.
--
-- Mirrors the parking suggestions cache (`parking_suggestions_cache_json`) but
-- keyed by arrival mode so a single column covers all 5 transit modes (train,
-- bus, airport, metro, taxi). Shape:
--   `Partial<Record<ArrivalMode, ArrivalSuggestion[]>>`
--
-- Lets the cockpit serve the "Sugeridos" column on first paint after the
-- operator has run a discovery for that mode at least once, instead of
-- discarding the result on navigation. NULLed alongside the parking cache by
-- `saveProperty` whenever coords could have shifted; operator refreshes per
-- mode via the icon-only button on the "Sugeridos" column.

ALTER TABLE "properties"
  ADD COLUMN "arrival_suggestions_cache_json" JSONB;
