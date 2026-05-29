-- 16E.6 — arrival cockpit per-mode metadata on local_places.
--
-- `is_recommended` lets the operator mark one option as the recommended one
-- within its arrival mode (e.g. one parking row out of several). Only
-- surfaced in the UI when ≥2 enabled options exist in the same mode.
--
-- `rate_json` carries the operator-edited tariff for paid arrival options
-- (paid parking, transit fares). Shape: array of up to 10 tier objects —
--   [{ amount: number, currency: string,
--      per: "minute"|"hour"|"day"|"week"|"month", note?: string }, ...]
-- Validated by `rateJsonSchema` / `rateTierSchema` in
-- `src/lib/schemas/rate-tier.schema.ts` (the single source of truth for the
-- tier cadences). Kept separate from `provider_metadata` so provider-emitted
-- data and operator configuration remain cleanly partitioned.

ALTER TABLE "local_places"
  ADD COLUMN "is_recommended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rate_json" JSONB;
