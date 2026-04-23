import {
  amenityTaxonomy,
  spaceTypes,
  policyTaxonomy,
  accessMethods,
  getAirbnbId,
  validatePlatformMapping,
} from "@/lib/taxonomy-loader";
import type { PlatformMapping, TaxonomyItem } from "@/lib/types/taxonomy";
import {
  coveredManifestEntries,
  type AirbnbStructuredManifestEntry,
} from "./manifest";
import type { ExportWarning } from "./types";

export type ManifestEntryKey = string;

export interface PropertyExportContext {
  propertyType: string | null;
  customPropertyTypeLabel: string | null;
  bedroomsCount: number | null;
  bathroomsCount: number | null;
  personCapacity: number | null;
  primaryAccessMethod: string | null;
  customAccessMethodLabel: string | null;
  policiesJson: Record<string, unknown> | null;
  /**
   * sp.* taxonomy ids of Spaces with `visibility === "guest"`. Used for
   * boolean presence signals (shared_spaces, amenities-by-space).
   */
  presentSpaceTypes: ReadonlySet<string>;
  /**
   * sp.* taxonomy id → number of matching Spaces with `visibility === "guest"`.
   * Used by room counters (bedrooms, bathrooms) to recover multiplicity that
   * `presentSpaceTypes` collapses. Keys are always `sp.*`; missing keys mean 0.
   */
  spaceTypeCounts: Readonly<Record<string, number>>;
  /** am.* / ax.* taxonomy ids of PropertyAmenityInstance with `visibility === "guest"`. */
  presentAmenityKeys: ReadonlySet<string>;
  defaultLocale: string;
}

// Narrow view of the shape produced by the policies-form. Kept local to the
// exporter because nothing else reads `policiesJson` at this layer.
interface PoliciesShape {
  quietHours?: { enabled?: boolean; from?: string; to?: string };
  smoking?: string;
  events?: { policy?: string; maxPeople?: number };
  pets?: { allowed?: boolean };
  commercialPhotography?: string;
  services?: { allowed?: boolean };
}

function asPolicies(value: Record<string, unknown> | null): PoliciesShape {
  return (value ?? {}) as PoliciesShape;
}

interface ManifestIndex {
  byKey: Map<ManifestEntryKey, AirbnbStructuredManifestEntry>;
  taxonomyItemsByKey: Map<ManifestEntryKey, TaxonomyItem[]>;
}

export function entryKey(entry: AirbnbStructuredManifestEntry): ManifestEntryKey {
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
  entry: AirbnbStructuredManifestEntry,
): boolean {
  if (mapping.platform !== "airbnb") return false;
  if (mapping.kind !== entry.kind) return false;
  if (mapping.kind === "structured_field" && entry.kind === "structured_field") {
    // Match both `field` AND `transform`: a taxonomy mapping that declares the
    // wrong transform (e.g. `bool` for a field the manifest treats as `enum`)
    // is semantically incorrect and must not count as coverage. Forward-gate
    // in `airbnb-export-manifest-coverage.test.ts` relies on this.
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
  byKey: Map<ManifestEntryKey, AirbnbStructuredManifestEntry>,
  item: TaxonomyItem,
): void {
  if (item.platform_supported === false) return;
  if (!Array.isArray(item.source)) return;
  for (const raw of item.source) {
    if (validatePlatformMapping(raw) !== null) continue;
    const mapping = raw as PlatformMapping;
    if (mapping.platform !== "airbnb") continue;
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
  const byKey = new Map<ManifestEntryKey, AirbnbStructuredManifestEntry>();
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

export function getManifestIndex(): ManifestIndex {
  return manifestIndex;
}

/** Test-only: list manifest entry keys without taxonomy items mapping to them. */
export function uncoveredManifestEntries(): AirbnbStructuredManifestEntry[] {
  return coveredManifestEntries.filter(
    (e) => (manifestIndex.taxonomyItemsByKey.get(entryKey(e)) ?? []).length === 0,
  );
}

// ── Domain reducers ──────────────────────────────────────────────────────
//
// Each reducer takes the matched taxonomy items + the property context and
// returns a value plus optional warnings. Reducers are pure: no Prisma, no
// IO. Tests construct a PropertyExportContext directly.

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

function presentInAmenities(
  items: TaxonomyItem[],
  ctx: PropertyExportContext,
): boolean {
  return items.some((i) => ctx.presentAmenityKeys.has(i.id));
}

export function reduceStructuredBool(
  entry: AirbnbStructuredManifestEntry,
  items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<boolean> {
  if (entry.kind !== "structured_field" || entry.transform !== "bool") {
    return { value: undefined, warnings: [] };
  }
  if (entry.target_taxonomy === "space_types") {
    // Presence-only signal: emit `true` when at least one mapped space is
    // present; otherwise omit (no signal). Avoids declaring "no kitchen" on
    // listings where the host simply hasn't configured spaces yet.
    return {
      value: presentInSpaces(items, ctx) ? true : undefined,
      warnings: [],
    };
  }
  if (entry.target_taxonomy === "amenities") {
    return {
      value: presentInAmenities(items, ctx) ? true : undefined,
      warnings: [],
    };
  }
  if (entry.target_taxonomy === "policies") {
    return reducePolicyBool(entry, items, ctx);
  }
  return { value: undefined, warnings: [] };
}

function reducePolicyBool(
  entry: AirbnbStructuredManifestEntry,
  items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<boolean> {
  if (entry.kind !== "structured_field") return { value: undefined, warnings: [] };
  const field = entry.field;
  const policies = asPolicies(ctx.policiesJson);

  switch (field) {
    case "listing_policies.events_allowed": {
      if (!policies.events?.policy) return { value: undefined, warnings: [] };
      return { value: policies.events.policy !== "not_allowed", warnings: [] };
    }
    case "listing_policies.pets_allowed": {
      if (typeof policies.pets?.allowed !== "boolean") return { value: undefined, warnings: [] };
      return { value: policies.pets.allowed, warnings: [] };
    }
    case "listing_policies.commercial_photography_allowed": {
      if (policies.commercialPhotography === undefined) return { value: undefined, warnings: [] };
      return { value: policies.commercialPhotography === "with_permission", warnings: [] };
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
  entry: AirbnbStructuredManifestEntry,
  items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<string> {
  if (entry.kind !== "structured_field" || entry.transform !== "enum") {
    return { value: undefined, warnings: [] };
  }
  const policies = asPolicies(ctx.policiesJson);

  // Smoking is passthrough + warning — our vocabulary doesn't match Airbnb's.
  if (entry.field === "listing_policies.smoking_allowed") {
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
          message: `Enum value "${smoking}" passed through verbatim — Airbnb option vocabulary not mapped in v1.`,
        },
      ],
    };
  }

  return { value: undefined, warnings: [] };
}

export function reduceStructuredNumber(
  entry: AirbnbStructuredManifestEntry,
  _items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<number> {
  if (entry.kind !== "structured_field" || entry.transform !== "number") {
    return { value: undefined, warnings: [] };
  }
  if (entry.field === "person_capacity") {
    return { value: ctx.personCapacity ?? undefined, warnings: [] };
  }
  return { value: undefined, warnings: [] };
}

export function reduceStructuredCurrency(
  entry: AirbnbStructuredManifestEntry,
  items: TaxonomyItem[],
  _ctx: PropertyExportContext,
): ReducerOutput<never> {
  // Property has no `currency` field, so emitting `supplements.*.amount`
  // without it would be ambiguous. Always omit + warn until currency lands.
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
  entry: AirbnbStructuredManifestEntry,
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
  // Fallback: sum real space counts (multiplicity-aware) across taxonomy
  // items that target this counter. `presentSpaceTypes` would cap out at the
  // number of distinct matching types (typically 1), so it's not usable here.
  let fallback = 0;
  for (const i of items) {
    fallback += ctx.spaceTypeCounts[i.id] ?? 0;
  }
  return { value: fallback > 0 ? fallback : undefined, warnings: [] };
}

export function reduceFreeText(
  entry: AirbnbStructuredManifestEntry,
  _items: TaxonomyItem[],
  ctx: PropertyExportContext,
): ReducerOutput<string> {
  if (entry.kind !== "free_text") return { value: undefined, warnings: [] };
  if (entry.field === "house_rules") {
    const rendered = renderHouseRules(ctx.policiesJson);
    if (!rendered) return { value: undefined, warnings: [] };
    return {
      value: rendered,
      warnings: [
        {
          code: "free_text_passthrough",
          field: "house_rules",
          message: `house_rules emitted in default locale "${ctx.defaultLocale}".`,
        },
      ],
    };
  }
  return { value: undefined, warnings: [] };
}

function renderHouseRules(policies: Record<string, unknown> | null): string | null {
  if (!policies) return null;
  const p = asPolicies(policies);
  const lines: string[] = [];

  if (p.quietHours?.enabled && p.quietHours.from && p.quietHours.to) {
    lines.push(`Horas de silencio: ${p.quietHours.from}–${p.quietHours.to}.`);
  }

  if (p.smoking === "not_allowed") lines.push("No fumar dentro del alojamiento.");
  else if (p.smoking === "outdoors_only") lines.push("Fumar permitido solo en exterior.");
  else if (p.smoking === "designated_area") lines.push("Fumar permitido solo en zona designada.");

  if (p.events?.policy === "not_allowed") lines.push("No se permiten fiestas ni eventos.");
  else if (p.events?.policy === "small_gatherings" && typeof p.events.maxPeople === "number") {
    lines.push(`Reuniones pequeñas permitidas (máximo ${p.events.maxPeople} personas).`);
  } else if (p.events?.policy === "with_approval") {
    lines.push("Eventos permitidos solo con aprobación previa.");
  }

  if (p.pets?.allowed === false) lines.push("No se admiten mascotas.");

  if (p.services?.allowed === false) lines.push("Servicios externos en el alojamiento no permitidos.");

  return lines.length === 0 ? null : lines.join(" ");
}

// ── Amenities — emit external_ids that are not part of the manifest ──────
//
// Manifest covers structured_field/room_counter/free_text. Plain amenities
// with `kind: "external_id"` are not iterated by the manifest engine — they
// produce a flat array `amenity_ids[]` based on `PropertyAmenityInstance`
// entries that have an Airbnb external_id mapping.

export function reduceAmenityExternalIds(
  ctx: PropertyExportContext,
): ReducerOutput<string[]> {
  const ids: string[] = [];
  const warnings: ExportWarning[] = [];
  for (const amenityKey of ctx.presentAmenityKeys) {
    const item = amenityItemById.get(amenityKey);
    if (!item) continue;
    if (item.platform_supported === false) continue;
    const airbnbId = getAirbnbId("amenities", amenityKey);
    if (airbnbId) ids.push(airbnbId);
  }
  return { value: ids.length > 0 ? ids : [], warnings };
}
