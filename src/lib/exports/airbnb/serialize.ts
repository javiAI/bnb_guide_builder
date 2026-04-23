import { prisma } from "@/lib/db";
import {
  airbnbListingPayloadSchema,
  type AirbnbListingPayload,
} from "@/lib/schemas/airbnb-listing";
import { getAirbnbId } from "@/lib/taxonomy-loader";
import { visibilityLevels, type VisibilityLevel } from "@/lib/visibility";
import {
  airbnbStructuredManifest,
  coveredManifestEntries,
} from "./manifest";
import {
  getManifestIndex,
  entryKey,
  reduceStructuredBool,
  reduceStructuredEnum,
  reduceStructuredNumber,
  reduceStructuredCurrency,
  reduceRoomCounter,
  reduceFreeText,
  reduceAmenityExternalIds,
  type PropertyExportContext,
} from "./engine";
import { resolvePropertyTypeCanonical } from "./property-type-canonical";
import type { AirbnbExportResult, ExportWarning } from "./types";

const GUEST_VISIBILITY: VisibilityLevel = visibilityLevels[0];

export class PropertyNotFoundError extends Error {
  constructor(propertyId: string) {
    super(`Property not found: ${propertyId}`);
    this.name = "PropertyNotFoundError";
  }
}

async function loadPropertyContext(
  propertyId: string,
): Promise<PropertyExportContext> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      propertyType: true,
      customPropertyTypeLabel: true,
      bedroomsCount: true,
      bathroomsCount: true,
      maxGuests: true,
      maxAdults: true,
      maxChildren: true,
      primaryAccessMethod: true,
      customAccessMethodLabel: true,
      policiesJson: true,
      defaultLocale: true,
      spaces: {
        where: { visibility: GUEST_VISIBILITY, status: "active" },
        select: { spaceType: true },
      },
      amenityInstances: {
        where: { visibility: GUEST_VISIBILITY },
        select: { amenityKey: true },
      },
    },
  });

  if (!property) throw new PropertyNotFoundError(propertyId);

  const personCapacity =
    property.maxGuests ?? property.maxAdults + property.maxChildren;

  return {
    propertyType: property.propertyType,
    customPropertyTypeLabel: property.customPropertyTypeLabel,
    bedroomsCount: property.bedroomsCount,
    bathroomsCount: property.bathroomsCount,
    personCapacity: personCapacity > 0 ? personCapacity : null,
    primaryAccessMethod: property.primaryAccessMethod,
    customAccessMethodLabel: property.customAccessMethodLabel,
    policiesJson:
      property.policiesJson && typeof property.policiesJson === "object"
        ? (property.policiesJson as Record<string, unknown>)
        : null,
    defaultLocale: property.defaultLocale,
    presentSpaceTypes: new Set(property.spaces.map((s) => s.spaceType)),
    presentAmenityKeys: new Set(property.amenityInstances.map((a) => a.amenityKey)),
  };
}

interface BuildResult {
  payload: AirbnbListingPayload;
  warnings: ExportWarning[];
}

export function buildAirbnbPayload(ctx: PropertyExportContext): BuildResult {
  const warnings: ExportWarning[] = [];
  const sharedSpaces: Record<string, boolean> = {};
  const amenities: Record<string, boolean> = {};
  const accessibilityFeatures: Record<string, boolean> = {};
  const listingPolicies: Record<string, boolean | string> = {};

  const draft: {
    property_type_category?: string;
    person_capacity?: number;
    bedrooms?: number;
    bathrooms?: number;
    check_in_method?: string;
    amenity_ids: string[];
    shared_spaces?: Record<string, boolean>;
    amenities?: Record<string, boolean>;
    accessibility_features?: Record<string, boolean>;
    listing_policies?: Record<string, boolean | string>;
    house_rules?: string;
    locale?: string;
  } = { amenity_ids: [] };

  // ── Property type (canonical resolver) ────────────────────────────────
  const ptResolution = resolvePropertyTypeCanonical(ctx.propertyType);
  if (ptResolution.unknown && ctx.propertyType) {
    warnings.push({
      code: "no_mapping",
      taxonomyKey: ctx.propertyType,
      message: `Unknown property type id "${ctx.propertyType}".`,
    });
  } else if (ptResolution.platformUnsupported) {
    warnings.push({
      code: "platform_not_supported",
      taxonomyKey: ctx.propertyType ?? undefined,
      message: `Property type "${ctx.propertyType}" is marked platform_supported:false.`,
    });
  } else if (!ptResolution.canonical) {
    if (ctx.customPropertyTypeLabel) {
      warnings.push({
        code: "custom_value_unmapped",
        taxonomyKey: ctx.propertyType ?? undefined,
        message: `Custom property type "${ctx.customPropertyTypeLabel}" has no Airbnb mapping; field omitted.`,
      });
    }
  } else {
    draft.property_type_category = ptResolution.canonical;
    if (ptResolution.alternatives.length > 0) {
      warnings.push({
        code: "no_mapping",
        taxonomyKey: ctx.propertyType ?? undefined,
        message: `Property type "${ctx.propertyType}" has multiple Airbnb aliases (${ptResolution.alternatives.join(", ")}); using canonical "${ptResolution.canonical}".`,
      });
    }
  }

  // ── check_in_method (direct external_id, not in manifest) ─────────────
  if (ctx.primaryAccessMethod) {
    try {
      const externalId = getAirbnbId("access_methods", ctx.primaryAccessMethod);
      if (externalId) {
        draft.check_in_method = externalId;
      } else if (ctx.customAccessMethodLabel) {
        warnings.push({
          code: "custom_value_unmapped",
          taxonomyKey: ctx.primaryAccessMethod,
          message: `Custom access method "${ctx.customAccessMethodLabel}" has no Airbnb mapping; field omitted.`,
        });
      } else {
        warnings.push({
          code: "no_mapping",
          taxonomyKey: ctx.primaryAccessMethod,
          message: `Access method "${ctx.primaryAccessMethod}" has no Airbnb external_id.`,
        });
      }
    } catch {
      warnings.push({
        code: "no_mapping",
        taxonomyKey: ctx.primaryAccessMethod,
        message: `Unknown access method id "${ctx.primaryAccessMethod}".`,
      });
    }
  }

  // ── Manifest-driven structured fields ─────────────────────────────────
  const index = getManifestIndex();
  for (const entry of coveredManifestEntries) {
    const items = index.taxonomyItemsByKey.get(entryKey(entry)) ?? [];

    if (entry.kind === "room_counter") {
      const out = reduceRoomCounter(entry, items, ctx);
      warnings.push(...out.warnings);
      if (out.value === undefined) continue;
      if (entry.counter === "bedrooms") draft.bedrooms = out.value;
      if (entry.counter === "bathrooms") draft.bathrooms = out.value;
      continue;
    }

    if (entry.kind === "free_text") {
      const out = reduceFreeText(entry, items, ctx);
      warnings.push(...out.warnings);
      if (out.value === undefined) continue;
      if (entry.field === "house_rules") draft.house_rules = out.value;
      continue;
    }

    // structured_field
    if (entry.transform === "bool") {
      const out = reduceStructuredBool(entry, items, ctx);
      warnings.push(...out.warnings);
      if (out.value === undefined) continue;
      assignStructuredBool(
        entry.field,
        out.value,
        sharedSpaces,
        amenities,
        accessibilityFeatures,
        listingPolicies,
      );
      continue;
    }
    if (entry.transform === "enum") {
      const out = reduceStructuredEnum(entry, items, ctx);
      warnings.push(...out.warnings);
      if (out.value === undefined) continue;
      const leaf = leafField(entry.field);
      if (entry.field.startsWith("listing_policies.")) listingPolicies[leaf] = out.value;
      continue;
    }
    if (entry.transform === "number") {
      const out = reduceStructuredNumber(entry, items, ctx);
      warnings.push(...out.warnings);
      if (out.value === undefined) continue;
      if (entry.field === "person_capacity") draft.person_capacity = out.value;
      continue;
    }
    if (entry.transform === "currency") {
      const out = reduceStructuredCurrency(entry, items, ctx);
      warnings.push(...out.warnings);
      continue;
    }
  }

  // ── Amenity external_ids (flat array) ─────────────────────────────────
  const amenityIdsOut = reduceAmenityExternalIds(ctx);
  warnings.push(...amenityIdsOut.warnings);
  draft.amenity_ids = amenityIdsOut.value ?? [];

  // ── Assemble nested maps if non-empty ─────────────────────────────────
  if (Object.keys(sharedSpaces).length > 0) draft.shared_spaces = sharedSpaces;
  if (Object.keys(amenities).length > 0) draft.amenities = amenities;
  if (Object.keys(accessibilityFeatures).length > 0) {
    draft.accessibility_features = accessibilityFeatures;
  }
  if (Object.keys(listingPolicies).length > 0) draft.listing_policies = listingPolicies;
  draft.locale = ctx.defaultLocale;

  const parsed = airbnbListingPayloadSchema.safeParse(draft);
  if (!parsed.success) {
    warnings.push({
      code: "schema_validation_failed",
      message: `Payload failed Zod validation: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    });
    // Return an empty-but-valid payload as a defensive fallback.
    return {
      payload: { amenity_ids: [] },
      warnings,
    };
  }

  return { payload: parsed.data, warnings };
}

function leafField(field: string): string {
  const idx = field.lastIndexOf(".");
  return idx === -1 ? field : field.slice(idx + 1);
}

function assignStructuredBool(
  field: string,
  value: boolean,
  sharedSpaces: Record<string, boolean>,
  amenities: Record<string, boolean>,
  accessibilityFeatures: Record<string, boolean>,
  listingPolicies: Record<string, boolean | string>,
): void {
  const leaf = leafField(field);
  if (field.startsWith("shared_spaces.")) sharedSpaces[leaf] = value;
  else if (field.startsWith("amenities.")) amenities[leaf] = value;
  else if (field.startsWith("accessibility_features.")) accessibilityFeatures[leaf] = value;
  else if (field.startsWith("listing_policies.")) listingPolicies[leaf] = value;
}

export async function serializeForAirbnb(
  propertyId: string,
): Promise<AirbnbExportResult> {
  const ctx = await loadPropertyContext(propertyId);
  const { payload, warnings } = buildAirbnbPayload(ctx);
  return {
    payload,
    warnings,
    generatedAt: new Date().toISOString(),
    taxonomyVersion: airbnbStructuredManifest.pinned_at,
  };
}
