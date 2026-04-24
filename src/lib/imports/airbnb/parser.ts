import type { PoliciesShape } from "@/lib/exports/shared/policies-shape";
import type {
  ImportWarning,
  PropertyImportContext,
} from "../shared/types";
import {
  resolveAirbnbAccessMethod,
  resolveAirbnbAmenity,
  resolveAirbnbPropertyType,
  type ExternalIdLookup,
} from "./catalogs";
import type { AirbnbListingInput } from "@/lib/schemas/airbnb-listing-input";

/**
 * Parse an Airbnb listing payload (already Zod-validated) into the canonical
 * `PropertyImportContext`. Pure, no IO, no Prisma.
 *
 * Invariants:
 * - Never attempts to reconstruct entity identity (Spaces, amenityInstances
 *   with subtype/configJson). Presence booleans go to `presencePings` where
 *   the reconciler marks them `unactionable: presence_signal_only`.
 * - Never resolves a scalar with a custom label: unresolved external_ids go
 *   to `unresolvedExternalIds` so the reconciler can emit `customs` entries.
 * - Binary mappings (events_allowed, commercial_photography_allowed) are
 *   projected to the coarsest internal value. The reconciler surfaces any
 *   granularity loss (e.g. Airbnb "allowed" vs DB "allowed_quiet") as
 *   `unactionable: lossy_projection` so the host decides.
 */
export function airbnbToCanonical(input: AirbnbListingInput): {
  context: PropertyImportContext;
  warnings: ReadonlyArray<ImportWarning>;
} {
  const warnings: ImportWarning[] = [];

  // ── Property type ───────────────────────────────────────────────────
  let propertyType: PropertyImportContext["propertyType"] = null;
  if (input.property_type_category) {
    const lookup = resolveAirbnbPropertyType(input.property_type_category);
    propertyType = projectLookup(
      lookup,
      input.property_type_category,
      "property_type_category",
      warnings,
    );
  }

  // ── Access method ───────────────────────────────────────────────────
  let primaryAccessMethod: PropertyImportContext["primaryAccessMethod"] = null;
  if (input.check_in_method) {
    const lookup = resolveAirbnbAccessMethod(input.check_in_method);
    primaryAccessMethod = projectLookup(
      lookup,
      input.check_in_method,
      "check_in_method",
      warnings,
    );
  }

  // ── Amenities (flat taxonomy keys from amenity_ids[]) ───────────────
  const amenityKeys = new Set<string>();
  const unresolvedAmenityIds: Array<{
    field: "amenity_ids";
    value: string;
    labelEn: string | null;
  }> = [];

  for (const externalId of input.amenity_ids) {
    const lookup = resolveAirbnbAmenity(externalId);
    if (lookup.outcome === "resolved") {
      amenityKeys.add(lookup.taxonomyId);
    } else if (lookup.outcome === "out_of_scope") {
      warnings.push({
        code: "platform_not_supported",
        field: `amenity_ids[${externalId}]`,
        message: `Airbnb amenity id "${externalId}" (${lookup.labelEn}) is out of scope${lookup.reason ? ` (${lookup.reason})` : ""}.`,
      });
      unresolvedAmenityIds.push({
        field: "amenity_ids",
        value: externalId,
        labelEn: lookup.labelEn,
      });
    } else {
      warnings.push({
        code: "unresolved_external_id",
        field: `amenity_ids[${externalId}]`,
        message: `Airbnb amenity id "${externalId}" does not match any known catalog entry.`,
      });
      unresolvedAmenityIds.push({
        field: "amenity_ids",
        value: externalId,
        labelEn: null,
      });
    }
  }

  // ── Policies partial (binary → coarsest internal value) ─────────────
  const policiesPartial: Partial<PoliciesShape> = {};
  const lp = input.listing_policies;

  if (lp) {
    if (typeof lp.smoking_allowed === "string") {
      policiesPartial.smoking = lp.smoking_allowed;
      warnings.push({
        code: "enum_value_passthrough",
        field: "listing_policies.smoking_allowed",
        message: `Smoking value "${lp.smoking_allowed}" passed through verbatim — Airbnb vocabulary may not match internal enum.`,
      });
    }
    if (typeof lp.events_allowed === "boolean") {
      policiesPartial.events = {
        policy: lp.events_allowed ? "allowed" : "not_allowed",
      };
    }
    if (typeof lp.pets_allowed === "boolean") {
      policiesPartial.pets = { allowed: lp.pets_allowed };
    }
    if (typeof lp.commercial_photography_allowed === "boolean") {
      policiesPartial.commercialPhotography = lp.commercial_photography_allowed
        ? "with_permission"
        : "not_allowed";
    }
  }

  // ── Presence pings (unactionable by default in the reconciler) ──────
  const presencePings: PropertyImportContext["presencePings"] = {
    sharedSpaces: pickBooleans(input.shared_spaces),
    amenitiesShellBools: pickBooleans(input.amenities),
    accessibilityFeatures: pickBooleans(input.accessibility_features),
  };

  // ── Pricing (may trigger requires_currency_for_fees) ────────────────
  const pricing: PropertyImportContext["pricing"] = {
    cleaningFee: input.pricing?.cleaning_fee ?? null,
    extraPersonFee: input.pricing?.extra_person_fee ?? null,
    currency: input.pricing?.currency ?? null,
  };

  if (
    (pricing.cleaningFee !== null || pricing.extraPersonFee !== null) &&
    !pricing.currency
  ) {
    warnings.push({
      code: "requires_currency_for_fees",
      field: "pricing",
      message:
        "Pricing fields received without a `currency` — reconciler will mark them unactionable until Property has a currency.",
    });
  }

  const context: PropertyImportContext = {
    propertyType,
    customPropertyTypeLabel: null,
    bedroomsCount: input.bedrooms ?? null,
    bathroomsCount: input.bathrooms ?? null,
    personCapacity: input.person_capacity ?? null,
    primaryAccessMethod,
    customAccessMethodLabel: null,
    policiesPartial,
    incomingAmenityKeys: amenityKeys,
    presencePings,
    freeText: {
      houseRules: input.house_rules ?? null,
    },
    pricing,
    unresolvedExternalIds: [
      ...(propertyType && propertyType.taxonomyId === null
        ? [
            {
              field: "property_type_category" as const,
              value: propertyType.sourceExternalId,
              labelEn: propertyType.sourceLabelEn,
            },
          ]
        : []),
      ...(primaryAccessMethod && primaryAccessMethod.taxonomyId === null
        ? [
            {
              field: "check_in_method" as const,
              value: primaryAccessMethod.sourceExternalId,
              labelEn: primaryAccessMethod.sourceLabelEn,
            },
          ]
        : []),
      ...unresolvedAmenityIds,
    ],
    incomingLocale: input.locale ?? null,
  };

  return { context, warnings };
}

// ── helpers ─────────────────────────────────────────────────────────────

function projectLookup(
  lookup: ExternalIdLookup,
  externalId: string,
  field: "property_type_category" | "check_in_method",
  warnings: ImportWarning[],
): PropertyImportContext["propertyType"] {
  if (lookup.outcome === "resolved") {
    return {
      taxonomyId: lookup.taxonomyId,
      sourceExternalId: externalId,
      sourceLabelEn: lookup.labelEn,
    };
  }
  if (lookup.outcome === "out_of_scope") {
    warnings.push({
      code: "platform_not_supported",
      field,
      message: `Airbnb "${field}" value "${externalId}" (${lookup.labelEn}) is out of scope${lookup.reason ? ` (${lookup.reason})` : ""}.`,
    });
    return {
      taxonomyId: null,
      sourceExternalId: externalId,
      sourceLabelEn: lookup.labelEn,
    };
  }
  warnings.push({
    code: "unresolved_external_id",
    field,
    message: `Airbnb "${field}" value "${externalId}" does not match any known catalog entry.`,
  });
  return {
    taxonomyId: null,
    sourceExternalId: externalId,
    sourceLabelEn: null,
  };
}

function pickBooleans(
  obj: Record<string, boolean | undefined> | undefined,
): Readonly<Record<string, boolean>> {
  if (!obj) return {};
  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "boolean") result[key] = value;
  }
  return result;
}
