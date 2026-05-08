-- 7b — scope toggles per access subsystem.
--
-- Adds `has_parking` (default true) and `has_accessibility_considerations`
-- (nullable tri-state: null = unanswered, false = opt-out, true = opt-in).
-- Combined with the pre-existing `has_building_access`, every subsystem
-- resolves deterministically to "configured" or "pending" — the legacy
-- "empty" state is gone.
--
-- Default `true` for parking matches the schema-default semantics: most
-- properties have parking concerns. Accessibility stays nullable so the
-- pending state can be distinguished from a deliberate opt-out.

ALTER TABLE "properties"
  ADD COLUMN "has_parking" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "properties"
  ADD COLUMN "has_accessibility_considerations" BOOLEAN;
