-- 16E.6 — persist arrival-mode discovery suggestions per property.
--
-- Mirrors the parking suggestions cache (`parking_suggestions_cache_json`) but
-- keyed by arrival mode so a single column covers all 6 transit modes
-- (airport, train, bus, metro, urban_bus, taxi). Shape:
--   `Partial<Record<ArrivalMode, ArrivalSuggestion[]>>`
--
-- Lets the cockpit serve the "Sugeridos" column on first paint after the
-- operator has run a discovery for that mode at least once, instead of
-- discarding the result on navigation. NULLed alongside the parking cache by
-- `saveProperty` whenever coords could have shifted; operator refreshes per
-- mode via the icon-only button on the "Sugeridos" column.
--
-- Concurrency: writes from different modes must NOT use read-modify-write —
-- two modes refreshed in parallel would race and one would lose its delta.
-- Writers (see `discoverArrivalForModeAction` in `arrival.actions.ts`) use an
-- atomic JSONB merge via `$executeRaw`:
--   UPDATE properties
--   SET arrival_suggestions_cache_json =
--     COALESCE(arrival_suggestions_cache_json, '{}'::jsonb) || $delta::jsonb
--   WHERE id = $1 AND workspace_id = $2
-- This composes deltas commutatively and keeps the ownership check inline.

ALTER TABLE "properties"
  ADD COLUMN "arrival_suggestions_cache_json" JSONB;
