import {
  bookingListingPayloadSchema,
  type BookingListingPayload,
} from "@/lib/schemas/booking-listing";
import {
  bookingStructuredManifest,
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
import { resolvePropertyTypeCanonical } from "../shared/property-type-canonical";
import { loadPropertyContext } from "../shared/load-property";
import type { BookingExportResult, ExportWarning } from "./types";

interface BuildResult {
  payload: BookingListingPayload;
  warnings: ExportWarning[];
}

export function buildBookingPayload(ctx: PropertyExportContext): BuildResult {
  const warnings: ExportWarning[] = [];
  const sharedSpaces: Record<string, boolean> = {};
  const amenities: Record<string, boolean> = {};
  const policies: Record<string, boolean | string> = {};

  const draft: {
    property_type_category?: string;
    max_occupancy?: number;
    bedrooms?: number;
    bathrooms?: number;
    amenity_ids: string[];
    shared_spaces?: Record<string, boolean>;
    amenities?: Record<string, boolean>;
    policies?: Record<string, boolean | string>;
    house_rules_text?: string;
    checkin_instructions?: string;
    locale?: string;
  } = { amenity_ids: [] };

  // ── Property type (canonical resolver) ────────────────────────────────
  const ptResolution = resolvePropertyTypeCanonical(ctx.propertyType, "booking");
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
        message: `Custom property type "${ctx.customPropertyTypeLabel}" has no Booking mapping; field omitted.`,
      });
    }
  } else {
    draft.property_type_category = ptResolution.canonical;
    if (ptResolution.alternatives.length > 0) {
      warnings.push({
        code: "no_mapping",
        taxonomyKey: ctx.propertyType ?? undefined,
        message: `Property type "${ctx.propertyType}" has multiple Booking aliases (${ptResolution.alternatives.join(", ")}); using canonical "${ptResolution.canonical}".`,
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
      if (entry.field === "house_rules_text") draft.house_rules_text = out.value;
      else if (entry.field === "checkin_instructions") draft.checkin_instructions = out.value;
      continue;
    }

    // structured_field
    if (entry.transform === "bool") {
      const out = reduceStructuredBool(entry, items, ctx);
      warnings.push(...out.warnings);
      if (out.value === undefined) continue;
      assignStructuredBool(entry.field, out.value, sharedSpaces, amenities, policies);
      continue;
    }
    if (entry.transform === "enum") {
      const out = reduceStructuredEnum(entry, items, ctx);
      warnings.push(...out.warnings);
      if (out.value === undefined) continue;
      const leaf = leafField(entry.field);
      if (entry.field.startsWith("policies.")) policies[leaf] = out.value;
      continue;
    }
    if (entry.transform === "number") {
      const out = reduceStructuredNumber(entry, items, ctx);
      warnings.push(...out.warnings);
      if (out.value === undefined) continue;
      if (entry.field === "max_occupancy") draft.max_occupancy = out.value;
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
  if (Object.keys(policies).length > 0) draft.policies = policies;
  draft.locale = ctx.defaultLocale;

  const parsed = bookingListingPayloadSchema.safeParse(draft);
  if (!parsed.success) {
    warnings.push({
      code: "schema_validation_failed",
      message: `Payload failed Zod validation: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    });
    return {
      payload: { amenity_ids: [] },
      warnings,
    };
  }

  return { payload: parsed.data, warnings };
}

export async function serializeForBooking(
  propertyId: string,
): Promise<BookingExportResult> {
  const ctx = await loadPropertyContext(propertyId);
  const { payload, warnings } = buildBookingPayload(ctx);
  return {
    payload,
    warnings,
    generatedAt: new Date().toISOString(),
    taxonomyVersion: bookingStructuredManifest.pinned_at,
  };
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
  policies: Record<string, boolean | string>,
): void {
  const leaf = leafField(field);
  if (field.startsWith("shared_spaces.")) sharedSpaces[leaf] = value;
  else if (field.startsWith("amenities.")) amenities[leaf] = value;
  else if (field.startsWith("policies.")) policies[leaf] = value;
}
