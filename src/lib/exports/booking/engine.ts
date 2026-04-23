import {
  amenityTaxonomy,
  spaceTypes,
  policyTaxonomy,
  accessMethods,
  getBookingId,
  validatePlatformMapping,
} from "@/lib/taxonomy-loader";
import type { PlatformMapping, TaxonomyItem } from "@/lib/types/taxonomy";
import type { PropertyExportContext } from "../shared/load-property";
import type { ExportWarning } from "../shared/types";
import { asPolicies } from "../shared/policies-shape";
import { renderHouseRules } from "../shared/render-house-rules";
import {
  coveredManifestEntries,
  type BookingStructuredManifestEntry,
} from "./manifest";

export type { PropertyExportContext } from "../shared/load-property";

export type ManifestEntryKey = string;

interface ManifestIndex {
  byKey: Map<ManifestEntryKey, BookingStructuredManifestEntry>;
  taxonomyItemsByKey: Map<ManifestEntryKey, TaxonomyItem[]>;
}

export function entryKey(entry: BookingStructuredManifestEntry): ManifestEntryKey {
  switch (entry.kind) {
    case "structured_field":
      return `structured_field:${entry.field}`;
    case "room_counter":
      return `room_counter:${entry.counter}`;
    case "free_text":
      return `free_text:${entry.field}`;
  }
}

function mappingMatchesEntry(
  mapping: PlatformMapping,
  entry: BookingStructuredManifestEntry,
): boolean {
  if (mapping.platform !== "booking") return false;
  if (mapping.kind !== entry.kind) return false;
  if (mapping.kind === "structured_field" && entry.kind === "structured_field") {
    return mapping.field === entry.field && mapping.transform === entry.transform;
  }
  if (mapping.kind === "room_counter" && entry.kind === "room_counter") {
    return mapping.counter === entry.counter;
  }
  if (mapping.kind === "free_text" && entry.kind === "free_text") {
    return mapping.field === entry.field;
  }
  return false;
}

function pushIfMatches(
  bucket: Map<ManifestEntryKey, TaxonomyItem[]>,
  byKey: Map<ManifestEntryKey, BookingStructuredManifestEntry>,
  item: TaxonomyItem,
): void {
  if (item.platform_supported === false) return;
  if (!Array.isArray(item.source)) return;
  for (const raw of item.source) {
    if (validatePlatformMapping(raw) !== null) continue;
    const mapping = raw as PlatformMapping;
    if (mapping.platform !== "booking") continue;
    for (const [key, entry] of byKey) {
      if (mappingMatchesEntry(mapping, entry)) {
        const list = bucket.get(key) ?? [];
        list.push(item);
        bucket.set(key, list);
      }
    }
  }
}

function buildManifestIndex(): ManifestIndex {
  const byKey = new Map<ManifestEntryKey, BookingStructuredManifestEntry>();
  for (const entry of coveredManifestEntries) {
    byKey.set(entryKey(entry), entry);
  }

  const taxonomyItemsByKey = new Map<ManifestEntryKey, TaxonomyItem[]>();

  for (const item of spaceTypes.items) {
    pushIfMatches(taxonomyItemsByKey, byKey, item);
  }
  for (const item of amenityTaxonomy.items) {
    pushIfMatches(taxonomyItemsByKey, byKey, item);
  }
  for (const group of policyTaxonomy.groups) {
    for (const item of group.items) {
      pushIfMatches(taxonomyItemsByKey, byKey, item);
    }
  }
  for (const item of accessMethods.items) {
    pushIfMatches(taxonomyItemsByKey, byKey, item);
  }

  return { byKey, taxonomyItemsByKey };
}

const manifestIndex = buildManifestIndex();

const amenityItemById = new Map(
  amenityTaxonomy.items.map((i) => [i.id, i] as const),
);

const accessMethodItemById = new Map(
  accessMethods.items.map((i) => [i.id, i] as const),
);

export function getManifestIndex(): ManifestIndex {
  return manifestIndex;
}

/** Test-only: list manifest entry keys without taxonomy items mapping to them. */
export function uncoveredManifestEntries(): BookingStructuredManifestEntry[] {
  return coveredManifestEntries.filter(
    (e) => (manifestIndex.taxonomyItemsByKey.get(entryKey(e)) ?? []).length === 0,
  );
}

// ── Domain reducers ──────────────────────────────────────────────────────

export interface ReducerOutput<T> {
  value: T | undefined;
  warnings: ExportWarning[];
}

function presentInSpaces(
  items: TaxonomyItem[],
  ctx: PropertyExportContext,
): boolean {
  return items.some((i) => ctx.presentSpaceTypes.has(i.id));
}

export function reduceStructuredBool(
  entry: BookingStructuredManifestEntry,
  items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<boolean> {
  if (entry.kind !== "structured_field" || entry.transform !== "bool") {
    return { value: undefined, warnings: [] };
  }
  if (entry.target_taxonomy === "space_types") {
    // Presence-only signal: emit `true` when at least one mapped space is
    // present; otherwise omit. Avoids declaring "no kitchen" on listings
    // where the host simply hasn't configured spaces yet.
    return {
      value: presentInSpaces(items, ctx) ? true : undefined,
      warnings: [],
    };
  }
  if (entry.target_taxonomy === "policies") {
    return reducePolicyBool(entry, items, ctx);
  }
  return { value: undefined, warnings: [] };
}

function reducePolicyBool(
  entry: BookingStructuredManifestEntry,
  items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<boolean> {
  if (entry.kind !== "structured_field") return { value: undefined, warnings: [] };
  const field = entry.field;
  const policies = asPolicies(ctx.policiesJson);

  switch (field) {
    case "policies.parties": {
      if (!policies.events?.policy) return { value: undefined, warnings: [] };
      return { value: policies.events.policy !== "not_allowed", warnings: [] };
    }
    case "policies.pets": {
      if (typeof policies.pets?.allowed !== "boolean") return { value: undefined, warnings: [] };
      return { value: policies.pets.allowed, warnings: [] };
    }
    default: {
      const taxonomyKey = items[0]?.id;
      return {
        value: undefined,
        warnings: [
          {
            code: "no_mapping",
            field,
            taxonomyKey,
            message: `No policy reducer for boolean field "${field}".`,
          },
        ],
      };
    }
  }
}

export function reduceStructuredEnum(
  entry: BookingStructuredManifestEntry,
  items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<string> {
  if (entry.kind !== "structured_field" || entry.transform !== "enum") {
    return { value: undefined, warnings: [] };
  }
  const policies = asPolicies(ctx.policiesJson);

  // Smoking is passthrough + warning — our vocabulary doesn't match Booking's.
  if (entry.field === "policies.smoking") {
    const smoking = typeof policies.smoking === "string" ? policies.smoking : null;
    if (!smoking) return { value: undefined, warnings: [] };
    const taxonomyKey = items[0]?.id;
    return {
      value: smoking,
      warnings: [
        {
          code: "enum_value_passthrough",
          field: entry.field,
          taxonomyKey,
          message: `Enum value "${smoking}" passed through verbatim — Booking option vocabulary not mapped in v1.`,
        },
      ],
    };
  }

  return { value: undefined, warnings: [] };
}

export function reduceStructuredNumber(
  entry: BookingStructuredManifestEntry,
  _items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<number> {
  if (entry.kind !== "structured_field" || entry.transform !== "number") {
    return { value: undefined, warnings: [] };
  }
  if (entry.field === "max_occupancy") {
    return { value: ctx.personCapacity ?? undefined, warnings: [] };
  }
  return { value: undefined, warnings: [] };
}

export function reduceStructuredCurrency(
  entry: BookingStructuredManifestEntry,
  items: TaxonomyItem[],
  _ctx: PropertyExportContext,
): ReducerOutput<never> {
  // Property has no `currency` field, so emitting `fees.*` without it would
  // be ambiguous. Always omit + warn until currency lands.
  if (entry.kind !== "structured_field" || entry.transform !== "currency") {
    return { value: undefined, warnings: [] };
  }
  const taxonomyKey = items[0]?.id;
  return {
    value: undefined,
    warnings: [
      {
        code: "missing_pricing_currency",
        field: entry.field,
        taxonomyKey,
        message: `Pricing field "${entry.field}" omitted: Property has no currency to pair with the amount.`,
      },
    ],
  };
}

export function reduceRoomCounter(
  entry: BookingStructuredManifestEntry,
  items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<number> {
  if (entry.kind !== "room_counter") return { value: undefined, warnings: [] };
  const direct =
    entry.counter === "bedrooms" ? ctx.bedroomsCount
    : entry.counter === "bathrooms" ? ctx.bathroomsCount
    : undefined;
  if (direct === undefined) return { value: undefined, warnings: [] };
  if (typeof direct === "number") return { value: direct, warnings: [] };
  let fallback = 0;
  for (const i of items) {
    fallback += ctx.spaceTypeCounts[i.id] ?? 0;
  }
  return { value: fallback > 0 ? fallback : undefined, warnings: [] };
}

export function reduceFreeText(
  entry: BookingStructuredManifestEntry,
  _items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<string> {
  if (entry.kind !== "free_text") return { value: undefined, warnings: [] };
  if (entry.field === "house_rules_text") {
    const rendered = renderHouseRules(ctx.policiesJson, {
      includeCommercialPhotography: true,
    });
    if (!rendered) return { value: undefined, warnings: [] };
    return {
      value: rendered,
      warnings: [
        {
          code: "free_text_passthrough",
          field: "house_rules_text",
          message: `house_rules_text emitted in default locale "${ctx.defaultLocale}".`,
        },
      ],
    };
  }
  if (entry.field === "checkin_instructions") {
    const rendered = renderCheckinInstructions(ctx);
    if (!rendered) return { value: undefined, warnings: [] };
    return {
      value: rendered,
      warnings: [
        {
          code: "free_text_passthrough",
          field: "checkin_instructions",
          message: `checkin_instructions emitted in default locale "${ctx.defaultLocale}".`,
        },
      ],
    };
  }
  return { value: undefined, warnings: [] };
}

function renderCheckinInstructions(ctx: PropertyExportContext): string | null {
  if (!ctx.primaryAccessMethod) return null;
  const item = accessMethodItemById.get(ctx.primaryAccessMethod);
  const label = item?.label;
  const parts: string[] = [];
  if (label) parts.push(label);
  if (ctx.customAccessMethodLabel) parts.push(ctx.customAccessMethodLabel);
  if (parts.length === 0) return null;
  return `Método de acceso: ${parts.join(" — ")}.`;
}

// ── Amenities — emit external_ids that are not part of the manifest ──────

export function reduceAmenityExternalIds(
  ctx: PropertyExportContext,
): ReducerOutput<string[]> {
  const ids: string[] = [];
  const warnings: ExportWarning[] = [];
  for (const amenityKey of ctx.presentAmenityKeys) {
    const item = amenityItemById.get(amenityKey);
    if (!item) continue;
    if (item.platform_supported === false) continue;
    const bookingId = getBookingId("amenities", amenityKey);
    if (bookingId) ids.push(bookingId);
  }
  return { value: ids.length > 0 ? ids : [], warnings };
}
