import { z } from "zod";
import airbnbPropertyTypesJson from "../../../../taxonomies/platform-catalogs/airbnb-property-types.json";
import airbnbAccessMethodsJson from "../../../../taxonomies/platform-catalogs/airbnb-access-methods.json";
import airbnbAmenitiesJson from "../../../../taxonomies/platform-catalogs/airbnb-amenities.json";

/**
 * Reverse index `external_id → internal taxonomy_id` built from the pinned
 * Airbnb catalogs (Rama 14A). These catalogs carry `collapsed_to` explicitly,
 * which is the canonical resolution when multiple external_ids map to the
 * same internal item (`cottage` + `townhouse` + `cabin` → `pt.house`).
 *
 * Why catalogs and not taxonomy `source[]`:
 * - Catalogs declare `out_of_scope` with `reason` — useful to surface
 *   informative warnings for external_ids we KNOW we chose not to support.
 * - Catalogs carry `label_en` — canonical English label used as fallback
 *   suggestion when a host's external_id doesn't resolve to an internal
 *   taxonomy item (`customs` diff category).
 * - The reverse gate (`platform-reverse-coverage.test.ts`, 14A) guarantees
 *   every `covered` entry points at a real taxonomy item, so we can trust
 *   `collapsed_to` to match the taxonomy.
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

const airbnbPropertyTypesCatalog = catalogFileSchema.parse(
  airbnbPropertyTypesJson,
);
const airbnbAccessMethodsCatalog = catalogFileSchema.parse(
  airbnbAccessMethodsJson,
);
const airbnbAmenitiesCatalog = catalogFileSchema.parse(airbnbAmenitiesJson);

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
      // Covered entries without `collapsed_to` would mean no internal target
      // — that's a catalog integrity failure that 14A's reverse gate should
      // catch, but we fail-fast here too for defense-in-depth.
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
  airbnbPropertyTypesCatalog.entries,
  "airbnb-property-types.json",
);

const accessMethodsIndex = buildReverseIndex(
  airbnbAccessMethodsCatalog.entries,
  "airbnb-access-methods.json",
);

const amenitiesIndex = buildReverseIndex(
  airbnbAmenitiesCatalog.entries,
  "airbnb-amenities.json",
);

// ── Public resolvers ─────────────────────────────────────────────────────

/** Result of resolving an Airbnb external_id to an internal taxonomy id. */
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

export function resolveAirbnbPropertyType(externalId: string): ExternalIdLookup {
  return lookup(externalId, propertyTypesIndex);
}

export function resolveAirbnbAccessMethod(
  externalId: string,
): ExternalIdLookup {
  return lookup(externalId, accessMethodsIndex);
}

export function resolveAirbnbAmenity(externalId: string): ExternalIdLookup {
  return lookup(externalId, amenitiesIndex);
}
