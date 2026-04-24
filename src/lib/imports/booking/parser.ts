import type { PoliciesShape } from "@/lib/exports/shared/policies-shape";
import type {
  ImportWarning,
  PropertyImportContext,
} from "../shared/types";
import {
  resolveBookingAmenity,
  resolveBookingPropertyType,
  type ExternalIdLookup,
} from "./catalogs";
import type { BookingListingInput } from "@/lib/schemas/booking-listing-input";

/**
 * Parse a Booking listing payload (already Zod-validated) into the canonical
 * `PropertyImportContext`. Pure, no IO, no Prisma.
 *
 * Key divergences from Airbnb parser:
 * - `max_occupancy` instead of `person_capacity`
 * - `fees.*` instead of `pricing.*`
 * - No `check_in_method` enum; `checkin_instructions` is free-text → goes to `freeText`
 * - No `accessibility_features` → silently dropped
 * - `policies.*` shape: `smoking`, `parties` (bool), `pets` (bool) — simpler than Airbnb
 *
 * Invariants (same as Airbnb):
 * - Never reconstructs entity identity (Spaces, amenityInstances).
 * - Never resolves a scalar with custom label; unresolved external_ids go to
 *   `unresolvedExternalIds` so the reconciler emits `customs` entries.
 * - Presence bools → presencePings (unactionable by default in reconciler).
 */
export function bookingToCanonical(input: BookingListingInput): {
  context: PropertyImportContext;
  warnings: ReadonlyArray<ImportWarning>;
} {
  const warnings: ImportWarning[] = [];

  // ── Property type ───────────────────────────────────────────────────
  let propertyType: PropertyImportContext["propertyType"] = null;
  if (input.property_type_category) {
    const lookup = resolveBookingPropertyType(input.property_type_category);
    propertyType = projectLookup(
      lookup,
      input.property_type_category,
      "property_type_category",
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
    const lookup = resolveBookingAmenity(externalId);
    if (lookup.outcome === "resolved") {
      amenityKeys.add(lookup.taxonomyId);
    } else if (lookup.outcome === "out_of_scope") {
      warnings.push({
        code: "platform_not_supported",
        field: `amenity_ids[${externalId}]`,
        message: `Booking amenity id "${externalId}" (${lookup.labelEn}) is out of scope${lookup.reason ? ` (${lookup.reason})` : ""}.`,
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
        message: `Booking amenity id "${externalId}" does not match any known catalog entry.`,
      });
      unresolvedAmenityIds.push({
        field: "amenity_ids",
        value: externalId,
        labelEn: null,
      });
    }
  }

  // ── Policies partial (Booking shape: smoking, parties, pets) ────────
  const policiesPartial: Partial<PoliciesShape> = {};
  const policies = input.policies;

  if (policies) {
    if (typeof policies.smoking === "string") {
      policiesPartial.smoking = policies.smoking;
      warnings.push({
        code: "enum_value_passthrough",
        field: "policies.smoking",
        message: `Smoking value "${policies.smoking}" passed through verbatim — Booking vocabulary may not match internal enum.`,
      });
    }
    if (typeof policies.parties === "boolean") {
      policiesPartial.events = {
        policy: policies.parties ? "allowed" : "not_allowed",
      };
    }
    if (typeof policies.pets === "boolean") {
      policiesPartial.pets = { allowed: policies.pets };
    }
  }

  // ── Presence pings (unactionable by default in the reconciler) ──────
  const presencePings: PropertyImportContext["presencePings"] = {
    sharedSpaces: pickBooleans(input.shared_spaces),
    amenitiesShellBools: pickBooleans(input.amenities),
    accessibilityFeatures: {}, // Booking has no accessibility_features → silent drop
  };

  // ── Pricing (fees may trigger requires_currency_for_fees) ──────────
  const pricing: PropertyImportContext["pricing"] = {
    cleaningFee: input.fees?.cleaning ?? null,
    extraPersonFee: input.fees?.extra_person ?? null,
    currency: input.fees?.currency ?? null,
  };

  if (
    (pricing.cleaningFee !== null || pricing.extraPersonFee !== null) &&
    !pricing.currency
  ) {
    warnings.push({
      code: "requires_currency_for_fees",
      field: "fees",
      message:
        "Pricing fields received without a `currency` — reconciler will mark them unactionable until Property has a currency.",
    });
  }

  // ── Free text: house_rules_text + checkin_instructions ──────────────────
  const freeText: PropertyImportContext["freeText"] = {
    houseRules: input.house_rules_text ?? null,
    checkInInstructions: input.checkin_instructions ?? null,
  };

  const context: PropertyImportContext = {
    propertyType,
    customPropertyTypeLabel: null,
    bedroomsCount: input.bedrooms ?? null,
    bathroomsCount: input.bathrooms ?? null,
    personCapacity: input.max_occupancy ?? null,
    primaryAccessMethod: null, // Booking has no check_in_method enum
    customAccessMethodLabel: null,
    policiesPartial,
    incomingAmenityKeys: amenityKeys,
    presencePings,
    freeText,
    pricing,
    unresolvedExternalIds: unresolvedAmenityIds,
    incomingLocale: input.locale ?? null,
  };

  return { context, warnings };
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Project an ExternalIdLookup result into PropertyImportContext scalar field.
 * If unresolved or out_of_scope, return { taxonomyId: null, ... } so the reconciler
 * can emit a `customs` entry (fallback suggestion). Never silently drop the external_id.
 */
function projectLookup(
  lookup: ExternalIdLookup,
  externalId: string,
  field: "property_type_category",
  warnings: ImportWarning[],
): PropertyImportContext["propertyType"] {
  if (lookup.outcome === "resolved") {
    return {
      taxonomyId: lookup.taxonomyId,
      sourceExternalId: externalId,
      sourceLabelEn: lookup.labelEn,
    };
  }
  // Both out_of_scope and unknown outcomes preserve the source id so the
  // reconciler can emit a customs entry (fallback label suggestion).
  if (lookup.outcome === "out_of_scope") {
    warnings.push({
      code: "platform_not_supported",
      field,
      taxonomyKey: undefined,
      message: `Booking ${field} "${externalId}" (${lookup.labelEn}) is out of scope${lookup.reason ? ` (${lookup.reason})` : ""}.`,
    });
  } else {
    warnings.push({
      code: "unresolved_external_id",
      field,
      message: `Booking ${field} "${externalId}" does not match any known catalog entry.`,
    });
  }
  return {
    taxonomyId: null,
    sourceExternalId: externalId,
    sourceLabelEn: lookup.outcome === "out_of_scope" ? lookup.labelEn : null,
  };
}

/**
 * Pick boolean-valued entries from a flat object, returning as Record<string, boolean>.
 */
function pickBooleans(
  obj: Record<string, boolean | undefined> | undefined,
): Record<string, boolean> {
  if (!obj) return {};
  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "boolean") {
      result[key] = value;
    }
  }
  return result;
}
