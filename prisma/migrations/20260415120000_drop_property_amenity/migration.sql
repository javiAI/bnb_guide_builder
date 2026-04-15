-- Drop legacy PropertyAmenity table. Reads have cut over to
-- PropertyAmenityInstance (+ PropertyAmenityPlacement) in Branch 2C and all
-- remaining dual-write code has been removed.
DROP TABLE IF EXISTS "property_amenities" CASCADE;
