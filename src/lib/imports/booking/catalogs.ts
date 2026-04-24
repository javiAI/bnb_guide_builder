import { z } from "zod";
import bookingPropertyTypesJson from "../../../../taxonomies/platform-catalogs/booking-property-types.json";
import bookingAmenitiesJson from "../../../../taxonomies/platform-catalogs/booking-amenities.json";

/**
 * Reverse index `external_id → internal taxonomy_id` built from the pinned
 * Booking catalogs (Rama 14A). Same pattern as Airbnb, but Booking has no
 * `access_methods` catalog (no check_in_method enum).
 *
 * Booking catalogs carry `collapsed_to` and `out_of_scope` with `reason`,
 * enabling fallback suggestions and informative warnings.
 *
 * Zod-parsed at module load: fail-fast on boot if any catalog drifts.
 */

const catalogEntrySchema = z.object({
  id: z.string().min(1),
  label_en: z.string().min(1),
  category: z.string().optional(),
  relevance: z.enum(["covered", "out_of_scope"]),
  reason: z.string().optional(),
  collapsed_to: z.string().optional(),
  notes: z.string().optional(),
});

const catalogFileSchema = z.object({
  pinned_at: z.string(),
  source_urls: z.array(z.string()),
  scope: z.string(),
  notes: z.string().optional(),
  entries: z.array(catalogEntrySchema),
});

type CatalogEntry = z.infer<typeof catalogEntrySchema>;

const bookingPropertyTypesCatalog = catalogFileSchema.parse(
  bookingPropertyTypesJson,
);
const bookingAmenitiesCatalog = catalogFileSchema.parse(bookingAmenitiesJson);

// ── Reverse indices ──────────────────────────────────────────────────────

export interface ReverseResolution {
  taxonomyId: string;
  labelEn: string;
}

export interface CatalogKnownEntry {
  labelEn: string;
  covered: boolean;
  reason: string | null;
}

function buildReverseIndex(
  entries: readonly CatalogEntry[],
  catalogName: string,
): {
  covered: Map<string, ReverseResolution>;
  known: Map<string, CatalogKnownEntry>;
} {
  const covered = new Map<string, ReverseResolution>();
  const known = new Map<string, CatalogKnownEntry>();

  for (const entry of entries) {
    known.set(entry.id, {
      labelEn: entry.label_en,
      covered: entry.relevance === "covered",
      reason: entry.reason ?? null,
    });

    if (entry.relevance !== "covered") continue;

    if (!entry.collapsed_to) {
      throw new Error(
        `${catalogName}: covered entry "${entry.id}" missing collapsed_to`,
      );
    }

    if (covered.has(entry.id)) {
      throw new Error(
        `${catalogName}: duplicate external_id "${entry.id}"`,
      );
    }

    covered.set(entry.id, {
      taxonomyId: entry.collapsed_to,
      labelEn: entry.label_en,
    });
  }

  return { covered, known };
}

const propertyTypesIndex = buildReverseIndex(
  bookingPropertyTypesCatalog.entries,
  "booking-property-types.json",
);

const amenitiesIndex = buildReverseIndex(
  bookingAmenitiesCatalog.entries,
  "booking-amenities.json",
);

// ── Public resolvers ─────────────────────────────────────────────────────

/** Result of resolving a Booking external_id to an internal taxonomy id. */
export type ExternalIdLookup =
  | { outcome: "resolved"; taxonomyId: string; labelEn: string }
  | { outcome: "out_of_scope"; labelEn: string; reason: string | null }
  | { outcome: "unknown" };

function lookup(
  externalId: string,
  index: {
    covered: Map<string, ReverseResolution>;
    known: Map<string, CatalogKnownEntry>;
  },
): ExternalIdLookup {
  const resolved = index.covered.get(externalId);
  if (resolved) {
    return {
      outcome: "resolved",
      taxonomyId: resolved.taxonomyId,
      labelEn: resolved.labelEn,
    };
  }
  const known = index.known.get(externalId);
  if (known) {
    return {
      outcome: "out_of_scope",
      labelEn: known.labelEn,
      reason: known.reason,
    };
  }
  return { outcome: "unknown" };
}

export function resolveBookingPropertyType(
  externalId: string,
): ExternalIdLookup {
  return lookup(externalId, propertyTypesIndex);
}

export function resolveBookingAmenity(externalId: string): ExternalIdLookup {
  return lookup(externalId, amenitiesIndex);
}
