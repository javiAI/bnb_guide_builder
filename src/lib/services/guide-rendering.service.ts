/**
 * GuideRenderingService — composes a typed `GuideTree` for a property,
 * scoped to an audience. The output is a single in-memory structure that
 * downstream renderers (9B markdown/html, AI retrieval, messaging) consume.
 *
 * Architectural commitment (see docs/MASTER_PLAN_V2.md §9A and
 * docs/CONFIG_DRIVEN_SYSTEM.md "Guide rendering engine — resiliencia"):
 *   1. Zero hardcoded taxonomy IDs in resolvers. Resolvers iterate entities
 *      and enrich from taxonomy — no amenity/space/system/policy ID literals.
 *   2. Taxonomy-keyed labels (spaces, amenities, policies, access methods,
 *      bed types, subtype fields) are resolved from the taxonomy — never
 *      translated inline per-ID. Generic field captions ("Check-in",
 *      "Teléfono", "Distancia", boolean "Sí/No") remain inline because they
 *      are section-shape metadata, not taxonomy values.
 *   3. Field formatting delegates to field-type-registry (rama 8B).
 *   4. Graceful degradation for deprecated taxonomy keys and unknown field
 *      types: emit `GuideItem { deprecated: true, rawKey }` / push warnings,
 *      never throw.
 */

import { prisma } from "@/lib/db";
import type {
  GuideAudience,
  GuideItem,
  GuideItemField,
  GuideMedia,
  GuideResolverKey,
  GuideSection,
  GuideSortBy,
  GuideTree,
} from "@/lib/types/guide-tree";
import {
  GUIDE_TREE_SCHEMA_VERSION,
  EMERGENCY_FIELD_LABELS,
} from "@/lib/types/guide-tree";
import {
  findAmenityItem,
  findSubtype,
  findItem,
  accessMethods as accessMethodsTaxonomy,
  bedTypes,
  getGuideSectionConfigs,
  getSpaceTypeItem,
  isHostRole,
  isVisibleForAudience,
  policyTaxonomy,
  spaceTypes,
  amenityTaxonomy,
} from "@/lib/taxonomy-loader";
import { isKnownFieldType } from "@/config/registries/field-type-registry";
import type { SubtypeField } from "@/lib/types/taxonomy";
import {
  type EntityMediaRef,
  loadEntityMedia,
  mediaKey,
} from "@/lib/services/guide-media.service";
import type { MediaEntityType } from "@/lib/schemas/editor.schema";

const PROPERTY_COVER_LABEL = "La casa";

// ──────────────────────────────────────────────
// Context — entities loaded once per compose()
// ──────────────────────────────────────────────

interface GuideContext {
  propertyId: string;
  /**
   * Public slug — required to build `/g/:slug/media/...` proxy URLs.
   * `null` when composing for internal/preview flows that never emit media URLs.
   */
  publicSlug: string | null;
  property: {
    id: string;
    checkInStart: string | null;
    checkInEnd: string | null;
    checkOutTime: string | null;
    primaryAccessMethod: string | null;
    accessMethodsJson: unknown;
    policiesJson: unknown;
    brandPaletteKey: string | null;
    brandLogoUrl: string | null;
  } | null;
  spaces: Array<{
    id: string;
    spaceType: string;
    name: string;
    visibility: GuideAudience;
    guestNotes: string | null;
    aiNotes: string | null;
    internalNotes: string | null;
    featuresJson: unknown;
    sortOrder: number;
    beds: Array<{ id: string; bedType: string; quantity: number }>;
  }>;
  amenityInstances: Array<{
    id: string;
    amenityKey: string;
    subtypeKey: string | null;
    detailsJson: unknown;
    guestInstructions: string | null;
    aiInstructions: string | null;
    internalNotes: string | null;
    troubleshootingNotes: string | null;
    runbookJson: unknown;
    visibility: GuideAudience;
    placements: Array<{ spaceId: string }>;
  }>;
  contacts: Array<{
    id: string;
    roleKey: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    guestVisibleNotes: string | null;
    internalNotes: string | null;
    emergencyAvailable: boolean;
    sortOrder: number;
    visibility: GuideAudience;
  }>;
  localPlaces: Array<{
    id: string;
    categoryKey: string;
    name: string;
    guestDescription: string | null;
    aiNotes: string | null;
    distanceMeters: number | null;
    hoursText: string | null;
    visibility: GuideAudience;
  }>;
  /**
   * Media indexed by `{entityType}:{entityId}`. Always empty when
   * `publicSlug` is null.
   */
  mediaByEntity: Map<string, GuideMedia[]>;
}

function takeMedia(
  ctx: GuideContext,
  entityType: MediaEntityType,
  entityId: string,
): GuideMedia[] {
  return ctx.mediaByEntity.get(mediaKey(entityType, entityId)) ?? [];
}

// Resolver keys whose sections flag `includesMedia:true`. Taxonomy is loaded
// at module init, so this is safe to compute once.
const MEDIA_RESOLVER_KEYS: ReadonlySet<GuideResolverKey> = new Set(
  getGuideSectionConfigs()
    .filter((s) => s.includesMedia)
    .map((s) => s.resolverKey),
);

// Section configs sorted by `order`, computed once at module load.
const SORTED_SECTION_CONFIGS: ReadonlyArray<ReturnType<typeof getGuideSectionConfigs>[number]> =
  [...getGuideSectionConfigs()].sort((a, b) => a.order - b.order);

async function loadGuideContext(
  propertyId: string,
  audience: GuideAudience,
  publicSlug: string | null,
): Promise<GuideContext> {
  const propertyPromise = prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      checkInStart: true,
      checkInEnd: true,
      checkOutTime: true,
      primaryAccessMethod: true,
      accessMethodsJson: true,
      policiesJson: true,
      brandPaletteKey: true,
      brandLogoUrl: true,
    },
  });
  const spacesPromise = prisma.space.findMany({
    where: { propertyId, status: "active" },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      spaceType: true,
      name: true,
      visibility: true,
      guestNotes: true,
      aiNotes: true,
      internalNotes: true,
      featuresJson: true,
      sortOrder: true,
      beds: {
        select: { id: true, bedType: true, quantity: true },
        orderBy: [{ bedType: "asc" }, { id: "asc" }],
      },
    },
  });
  const amenityInstancesPromise = prisma.propertyAmenityInstance.findMany({
    where: { propertyId },
    select: {
      id: true,
      amenityKey: true,
      subtypeKey: true,
      detailsJson: true,
      guestInstructions: true,
      aiInstructions: true,
      internalNotes: true,
      troubleshootingNotes: true,
      runbookJson: true,
      visibility: true,
      placements: { select: { spaceId: true } },
    },
  });
  const contactsPromise = prisma.contact.findMany({
    where: { propertyId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      roleKey: true,
      displayName: true,
      phone: true,
      email: true,
      guestVisibleNotes: true,
      internalNotes: true,
      emergencyAvailable: true,
      sortOrder: true,
      visibility: true,
    },
  });
  const localPlacesPromise = prisma.localPlace.findMany({
    where: { propertyId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      categoryKey: true,
      name: true,
      guestDescription: true,
      aiNotes: true,
      distanceMeters: true,
      hoursText: true,
      visibility: true,
    },
  });

  // Media load needs property + spaces + amenity instances for entity labels.
  // Wait for those three, then run the media query in parallel with contacts
  // and localPlaces (neither contributes media refs).
  const [property, spaces, amenityInstances] = await Promise.all([
    propertyPromise,
    spacesPromise,
    amenityInstancesPromise,
  ]);

  const mediaRefs: EntityMediaRef[] = [];
  if (property && MEDIA_RESOLVER_KEYS.has("arrival")) {
    mediaRefs.push({
      entityType: "property",
      entityId: property.id,
      entityLabel: PROPERTY_COVER_LABEL,
    });
    if (property.primaryAccessMethod) {
      const acc = findItem(accessMethodsTaxonomy, property.primaryAccessMethod);
      mediaRefs.push({
        entityType: "access_method",
        entityId: property.id,
        entityLabel: acc?.label ?? property.primaryAccessMethod,
      });
    }
  }
  if (MEDIA_RESOLVER_KEYS.has("spaces")) {
    for (const s of spaces) {
      const typeItem = getSpaceTypeItem(s.spaceType);
      mediaRefs.push({
        entityType: "space",
        entityId: s.id,
        entityLabel: s.name || typeItem?.label || s.spaceType,
      });
    }
  }
  if (MEDIA_RESOLVER_KEYS.has("amenities")) {
    for (const inst of amenityInstances) {
      const item = findAmenityItem(inst.amenityKey);
      mediaRefs.push({
        entityType: "amenity_instance",
        entityId: inst.id,
        entityLabel: item?.label ?? inst.amenityKey,
      });
    }
  }

  const [mediaByEntity, contacts, localPlaces] = await Promise.all([
    loadEntityMedia(publicSlug, audience, mediaRefs),
    contactsPromise,
    localPlacesPromise,
  ]);

  return {
    propertyId,
    publicSlug,
    property,
    spaces,
    amenityInstances,
    contacts,
    localPlaces,
    mediaByEntity,
  };
}

// ──────────────────────────────────────────────
// Field formatting — delegate to field-type-registry (rama 8B)
// ──────────────────────────────────────────────

/**
 * Formats a subtype field value. Unknown field types emit a warning and
 * fall through to `String(value)` — they never throw here.
 *
 * The field-type-registry's `getFieldType()` does throw for unknown types,
 * which is the right behavior at form-validation time. For rendering we've
 * already persisted data; throwing here would break the entire guide.
 */
export function formatFieldValue(
  field: { id: string; label: string; type: string; options?: { id: string; label: string }[] },
  rawValue: unknown,
): { value: string; warning: string | null } {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return { value: "", warning: null };
  }
  if (!isKnownFieldType(field.type)) {
    return {
      value: String(rawValue),
      warning: `unknown_field_type:${field.type}`,
    };
  }
  // Shallow formatting by type family — keeps the engine stub-level; 9B
  // renderer can specialize further if needed.
  switch (field.type) {
    case "boolean":
      return { value: rawValue === true ? "Sí" : "No", warning: null };
    case "enum":
    case "enum_optional": {
      const opt = field.options?.find((o) => o.id === rawValue);
      return { value: opt?.label ?? String(rawValue), warning: null };
    }
    default:
      return { value: String(rawValue), warning: null };
  }
}

function pickVisibleNotes(
  notes: {
    guest?: string | null;
    ai?: string | null;
    internal?: string | null;
  },
): GuideItemField[] {
  const out: GuideItemField[] = [];
  if (notes.guest) out.push({ label: "Notas", value: notes.guest, visibility: "guest" });
  if (notes.ai) out.push({ label: "Notas AI", value: notes.ai, visibility: "ai" });
  if (notes.internal)
    out.push({ label: "Notas internas", value: notes.internal, visibility: "internal" });
  return out;
}

// ──────────────────────────────────────────────
// Sort helpers
// ──────────────────────────────────────────────

function alphaSort(items: GuideItem[]): GuideItem[] {
  return [...items].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function taxonomyOrderSort(
  items: GuideItem[],
  order: string[],
): GuideItem[] {
  const idx = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const ai = a.taxonomyKey ? idx.get(a.taxonomyKey) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const bi = b.taxonomyKey ? idx.get(b.taxonomyKey) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

function recommendedFirstSort(
  items: GuideItem[],
  recommendedSet: Set<string>,
): GuideItem[] {
  return [...items].sort((a, b) => {
    const ar = a.taxonomyKey && recommendedSet.has(a.taxonomyKey) ? 0 : 1;
    const br = b.taxonomyKey && recommendedSet.has(b.taxonomyKey) ? 0 : 1;
    if (ar !== br) return ar - br;
    return a.label.localeCompare(b.label, "es");
  });
}

// Precomputed once at module load — taxonomies are immutable at runtime.
const RECOMMENDED_AMENITIES: ReadonlySet<string> = new Set(
  amenityTaxonomy.items.filter((a) => a.recommended).map((a) => a.id),
);
const EMPTY_SET: ReadonlySet<string> = new Set();

const POLICY_ORDER = policyTaxonomy.groups.flatMap((g) => g.items.map((i) => i.id));
const AMENITY_ORDER = amenityTaxonomy.items.map((a) => a.id);

const TAXONOMY_ORDER_BY_RESOLVER: Partial<Record<GuideResolverKey, readonly string[]>> = {
  spaces: spaceTypes.items.map((s) => s.id),
  amenities: AMENITY_ORDER,
  rules: POLICY_ORDER,
  howto: AMENITY_ORDER,
  checkout: POLICY_ORDER,
};

function applySort(
  items: GuideItem[],
  sortBy: GuideSortBy,
  resolverKey: GuideResolverKey,
): GuideItem[] {
  switch (sortBy) {
    case "alpha":
      return alphaSort(items);
    case "explicit_order":
      return items; // resolvers emit in explicit order already
    case "recommended_first": {
      const set = resolverKey === "amenities" ? RECOMMENDED_AMENITIES : EMPTY_SET;
      return recommendedFirstSort(items, set as Set<string>);
    }
    case "taxonomy_order": {
      const order = TAXONOMY_ORDER_BY_RESOLVER[resolverKey] ?? [];
      return taxonomyOrderSort(items, order as string[]);
    }
  }
}

// ──────────────────────────────────────────────
// Audience filtering — sensitive is never included in tree output
// ──────────────────────────────────────────────

export function filterByAudience(
  items: GuideItem[],
  audience: GuideAudience,
): GuideItem[] {
  if (audience === "sensitive") {
    // Sensitive is a hard gate; it never produces a tree. Callers must
    // use `internal` to see everything they can legally see.
    return [];
  }
  const filtered: GuideItem[] = [];
  for (const item of items) {
    if (!isVisibleForAudience(item.visibility, audience)) continue;
    const fields = item.fields.filter((f) => isVisibleForAudience(f.visibility, audience));
    const children = filterByAudience(item.children, audience);
    filtered.push({ ...item, fields, children });
  }
  return filtered;
}

// ──────────────────────────────────────────────
// Resolvers — one per section. ZERO hardcoded IDs allowed below.
// ──────────────────────────────────────────────

function resolveArrival(ctx: GuideContext): GuideItem[] {
  const p = ctx.property;
  if (!p) return [];
  const items: GuideItem[] = [];

  // Property cover surfaces as a synthetic first item when there are assets
  // assigned to the property entity. The renderer shows it as a labeled figure.
  const propertyMedia = takeMedia(ctx, "property", p.id);
  if (propertyMedia.length > 0) {
    items.push({
      id: "arrival.property",
      taxonomyKey: null,
      label: PROPERTY_COVER_LABEL,
      value: null,
      visibility: "guest",
      deprecated: false,
      warnings: [],
      fields: [],
      media: propertyMedia,
      children: [],
      journeyStage: "arrival",
      journeyTags: ["essential"],
    });
  }

  const checkInRange =
    p.checkInStart || p.checkInEnd
      ? `${p.checkInStart ?? "?"} – ${p.checkInEnd ?? "?"}`
      : null;
  if (checkInRange) {
    items.push({
      id: "arrival.checkin",
      taxonomyKey: null,
      label: "Check-in",
      value: checkInRange,
      visibility: "guest",
      deprecated: false,
      warnings: [],
      fields: [],
      media: [],
      children: [],
      journeyStage: "arrival",
      journeyTags: ["essential"],
    });
  }
  if (p.primaryAccessMethod) {
    const item = findItem(accessMethodsTaxonomy, p.primaryAccessMethod);
    items.push({
      id: "arrival.access",
      taxonomyKey: p.primaryAccessMethod,
      label: item?.label ?? p.primaryAccessMethod,
      value: item?.description ?? null,
      visibility: "guest",
      deprecated: !item,
      warnings: [],
      fields: [],
      media: takeMedia(ctx, "access_method", p.id),
      children: [],
      journeyStage: "arrival",
      journeyTags: ["essential"],
    });
  }
  return items;
}

function resolveSpaces(ctx: GuideContext): GuideItem[] {
  return ctx.spaces.map((space) => {
    const typeItem = getSpaceTypeItem(space.spaceType);
    const bedFields: GuideItemField[] = space.beds.map((b) => {
      const bedTypeItem = findItem(bedTypes, b.bedType);
      return {
        label: bedTypeItem?.label ?? b.bedType,
        value: String(b.quantity),
        visibility: "guest",
      };
    });
    return {
      id: space.id,
      taxonomyKey: space.spaceType,
      label: space.name || typeItem?.label || space.spaceType,
      value: typeItem?.label ?? space.spaceType,
      visibility: space.visibility,
      deprecated: !typeItem,
      warnings: [],
      fields: [
        ...pickVisibleNotes({
          guest: space.guestNotes,
          ai: space.aiNotes,
          internal: space.internalNotes,
        }),
        ...bedFields,
      ],
      media: takeMedia(ctx, "space", space.id),
      children: [],
    };
  });
}

type SubtypeFieldLike = {
  id: string;
  label: string;
  type: string;
  visibility?: GuideAudience | string;
  options?: { id: string; label: string }[];
};

function resolveSubtypeFields(
  fields: ReadonlyArray<SubtypeFieldLike>,
  detailsJson: unknown,
): { fields: GuideItemField[]; warnings: string[] } {
  const out: GuideItemField[] = [];
  const warnings: string[] = [];
  const details = (detailsJson ?? {}) as Record<string, unknown>;
  for (const f of fields) {
    const raw = details[f.id];
    const { value, warning } = formatFieldValue(f, raw);
    if (warning) warnings.push(`${f.id}:${warning}`);
    if (!value) continue;
    const vis: GuideAudience =
      f.visibility === "sensitive"
        ? "sensitive"
        : f.visibility === "internal"
          ? "internal"
          : "guest";
    out.push({ label: f.label, value, visibility: vis });
  }
  return { fields: out, warnings };
}

function resolveAmenities(ctx: GuideContext): GuideItem[] {
  return ctx.amenityInstances.map((inst) => {
    const item = findAmenityItem(inst.amenityKey);
    const subtype = findSubtype(inst.amenityKey);
    const subtypeResult =
      subtype != null
        ? resolveSubtypeFields(subtype.fields as SubtypeField[], inst.detailsJson)
        : { fields: [], warnings: [] };
    return {
      id: inst.id,
      taxonomyKey: inst.amenityKey,
      label: item?.label ?? inst.amenityKey,
      value: item?.description ?? null,
      visibility: inst.visibility,
      deprecated: !item,
      warnings: subtypeResult.warnings,
      fields: [
        ...subtypeResult.fields,
        ...pickVisibleNotes({
          guest: inst.guestInstructions,
          ai: inst.aiInstructions,
          internal: inst.internalNotes,
        }),
      ],
      media: takeMedia(ctx, "amenity_instance", inst.id),
      children: [],
      journeyStage: item?.journeyStage,
      journeyTags: item?.journeyTags,
    };
  });
}

/** Runbook steps emitted by the howto resolver. The React renderer consumes
 * this as an ordered list; raw JSON in the DB can be either a string (legacy)
 * or an array of `{ label, detail }`. */
export interface GuideRunbookStep {
  label: string;
  detail?: string;
}

function parseRunbookSteps(raw: unknown): GuideRunbookStep[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  const steps: GuideRunbookStep[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const label = (entry as { label?: unknown }).label;
    if (typeof label !== "string" || label.trim() === "") continue;
    const detail = (entry as { detail?: unknown }).detail;
    steps.push({
      label,
      detail: typeof detail === "string" && detail.trim() !== "" ? detail : undefined,
    });
  }
  return steps;
}

function resolveHowto(ctx: GuideContext): GuideItem[] {
  const items: GuideItem[] = [];
  for (const inst of ctx.amenityInstances) {
    const steps = parseRunbookSteps(inst.runbookJson);
    const hasTrouble = !!inst.troubleshootingNotes?.trim();
    const hasGuestInstructions = !!inst.guestInstructions?.trim();
    if (steps.length === 0 && !hasTrouble && !hasGuestInstructions) continue;
    const item = findAmenityItem(inst.amenityKey);
    const fields: GuideItemField[] = [];
    if (hasGuestInstructions) {
      fields.push({
        label: "Instrucciones",
        value: inst.guestInstructions as string,
        visibility: "guest",
      });
    }
    if (hasTrouble) {
      fields.push({
        label: "Solución de problemas",
        value: inst.troubleshootingNotes as string,
        visibility: "guest",
      });
    }
    items.push({
      id: `howto.${inst.id}`,
      taxonomyKey: inst.amenityKey,
      label: item?.label ?? inst.amenityKey,
      value: null,
      visibility: inst.visibility,
      deprecated: !item,
      warnings: [],
      fields,
      media: [],
      children: steps.map((step, idx) => ({
        id: `howto.${inst.id}.step.${idx}`,
        taxonomyKey: null,
        label: step.label,
        value: step.detail ?? null,
        visibility: "guest",
        deprecated: false,
        warnings: [],
        fields: [],
        media: [],
        children: [],
      })),
      journeyStage: "stay",
    });
  }
  return items;
}

/**
 * Maps taxonomy IDs (pol.*, fee.*) to the camelCase keys stored in policiesJson.
 * The form saves with camelCase keys directly; fee.* items are nested under
 * `supplements`.
 */
const POLICY_TAXONOMY_TO_DB: Record<string, string | { parent: string; child: string }> = {
  "pol.quiet_hours": "quietHours",
  "pol.smoking": "smoking",
  "pol.events": "events",
  "pol.pets": "pets",
  "pol.commercial_photography": "commercialPhotography",
  "pol.services_in_home": "services",
  // pol.max_guests → top-level Property.maxGuests column, not in policiesJson
  // pol.checkin_checkout → type:"ref" in taxonomy, not stored
  "fee.cleaning": { parent: "supplements", child: "cleaning" },
  "fee.extra_guest": { parent: "supplements", child: "extraGuest" },
  // fee.pet is type:"ref" in taxonomy (points to pol.pets fee fields), not a stored value
};

function lookupPolicyValue(
  parsed: Record<string, unknown>,
  taxonomyId: string,
): unknown {
  const mapping = POLICY_TAXONOMY_TO_DB[taxonomyId];
  if (!mapping) return undefined;
  if (typeof mapping === "string") return parsed[mapping];
  // Nested key (fee.* → supplements.child)
  const parentObj = parsed[mapping.parent];
  if (typeof parentObj !== "object" || parentObj === null) return undefined;
  return (parentObj as Record<string, unknown>)[mapping.child];
}

function parsePoliciesJson(
  raw: unknown,
): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

/** Builds GuideItems for policies whose `journeyStage` matches the filter.
 * Items without a declared stage default to `"stay"` (backwards compatibility
 * with un-tagged taxonomy entries). */
function resolvePoliciesByStage(
  parsed: Record<string, unknown>,
  stageFilter: (stage: "arrival" | "stay" | "checkout" | "help") => boolean,
): { items: GuideItem[]; coveredDbKeys: Set<string> } {
  const items: GuideItem[] = [];
  const coveredDbKeys = new Set<string>();
  for (const group of policyTaxonomy.groups) {
    for (const policyItem of group.items) {
      const mapping = POLICY_TAXONOMY_TO_DB[policyItem.id];
      if (mapping) {
        coveredDbKeys.add(typeof mapping === "string" ? mapping : mapping.parent);
      }
      const stage = (policyItem.journeyStage ?? "stay") as
        | "arrival"
        | "stay"
        | "checkout"
        | "help";
      if (!stageFilter(stage)) continue;
      const rawValue = lookupPolicyValue(parsed, policyItem.id);
      if (rawValue === undefined || rawValue === null) continue;
      const valueStr =
        typeof rawValue === "object"
          ? JSON.stringify(rawValue)
          : String(rawValue);
      if (valueStr === "" || valueStr === "{}" || valueStr === "null") continue;
      items.push({
        id: `policy.${policyItem.id}`,
        taxonomyKey: policyItem.id,
        label: policyItem.label,
        value: valueStr,
        visibility: "guest",
        deprecated: false,
        warnings: [],
        fields: [],
        media: [],
        children: [],
        journeyStage: stage,
        journeyTags: policyItem.journeyTags,
      });
    }
  }
  return { items, coveredDbKeys };
}

function resolveRules(ctx: GuideContext): GuideItem[] {
  const parsed = parsePoliciesJson(ctx.property?.policiesJson);
  if (!parsed) return [];
  const { items, coveredDbKeys } = resolvePoliciesByStage(
    parsed,
    (stage) => stage !== "checkout",
  );
  // Keys not covered by the taxonomy surface as deprecated so renamed policies
  // never swallow persisted data.
  for (const [key, value] of Object.entries(parsed)) {
    if (coveredDbKeys.has(key)) continue;
    if (value === undefined || value === null) continue;
    const valueStr =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    if (valueStr === "" || valueStr === "{}" || valueStr === "null") continue;
    items.push({
      id: `policy.${key}`,
      taxonomyKey: key,
      label: key,
      value: valueStr,
      visibility: "internal",
      deprecated: true,
      warnings: ["deprecated_policy_key"],
      fields: [],
      media: [],
      children: [],
    });
  }
  return items;
}

function resolveCheckout(ctx: GuideContext): GuideItem[] {
  const p = ctx.property;
  const items: GuideItem[] = [];
  if (p?.checkOutTime) {
    items.push({
      id: "checkout.time",
      taxonomyKey: null,
      label: "Hora de check-out",
      value: p.checkOutTime,
      visibility: "guest",
      deprecated: false,
      warnings: [],
      fields: [],
      media: [],
      children: [],
      journeyStage: "checkout",
      journeyTags: ["essential"],
    });
  }
  const parsed = parsePoliciesJson(p?.policiesJson);
  if (parsed) {
    const { items: policyItems } = resolvePoliciesByStage(
      parsed,
      (stage) => stage === "checkout",
    );
    items.push(...policyItems);
  }
  return items;
}

/** Rama 10E fused the old `gs.contacts` section into `gs.emergency` (now
 * "Ayuda y emergencias"). Host/cohost contacts feed the help section
 * alongside emergency-flagged ones, with `emergencyAvailable=true` ranked
 * first. */
function resolveEmergency(ctx: GuideContext): GuideItem[] {
  const relevant = ctx.contacts.filter(
    (c) => c.emergencyAvailable || isHostRole(c.roleKey),
  );
  return relevant
    .sort((a, b) => {
      if (a.emergencyAvailable !== b.emergencyAvailable) {
        return a.emergencyAvailable ? -1 : 1;
      }
      return a.sortOrder - b.sortOrder;
    })
    .map((c) => contactToGuideItem(c));
}

function contactToGuideItem(
  c: GuideContext["contacts"][number],
): GuideItem {
  const fields: GuideItemField[] = [];
  if (c.phone)
    fields.push({ label: EMERGENCY_FIELD_LABELS.phone, value: c.phone, visibility: "guest" });
  if (c.email)
    fields.push({ label: EMERGENCY_FIELD_LABELS.email, value: c.email, visibility: "guest" });
  if (c.guestVisibleNotes)
    fields.push({ label: EMERGENCY_FIELD_LABELS.notes, value: c.guestVisibleNotes, visibility: "guest" });
  if (c.internalNotes)
    fields.push({
      label: "Notas internas",
      value: c.internalNotes,
      visibility: "internal",
    });
  return {
    id: c.id,
    taxonomyKey: c.roleKey,
    label: c.displayName,
    value: c.roleKey,
    visibility: c.visibility,
    deprecated: false,
    warnings: [],
    fields,
    media: [],
    children: [],
  };
}

function resolveLocal(ctx: GuideContext): GuideItem[] {
  return ctx.localPlaces.map((lp) => {
    const fields: GuideItemField[] = [];
    if (lp.distanceMeters != null) {
      fields.push({
        label: "Distancia",
        value: `${lp.distanceMeters} m`,
        visibility: "guest",
      });
    }
    if (lp.hoursText) {
      fields.push({ label: "Horario", value: lp.hoursText, visibility: "guest" });
    }
    if (lp.guestDescription) {
      fields.push({
        label: "Descripción",
        value: lp.guestDescription,
        visibility: "guest",
      });
    }
    if (lp.aiNotes) {
      fields.push({ label: "Notas AI", value: lp.aiNotes, visibility: "ai" });
    }
    return {
      id: lp.id,
      taxonomyKey: lp.categoryKey,
      label: lp.name,
      value: null,
      visibility: lp.visibility,
      deprecated: false,
      warnings: [],
      fields,
      media: [],
      children: [],
    };
  });
}

// Leaf resolvers produce items from the raw GuideContext only. The aggregator
// registry below runs after all leaves and can consume their outputs.
type LeafResolver = (ctx: GuideContext) => GuideItem[];

const LEAF_RESOLVERS: Partial<Record<GuideResolverKey, LeafResolver>> = {
  arrival: resolveArrival,
  spaces: resolveSpaces,
  howto: resolveHowto,
  amenities: resolveAmenities,
  rules: resolveRules,
  checkout: resolveCheckout,
  local: resolveLocal,
  emergency: resolveEmergency,
};

/** An aggregator clones items from other (already-resolved) leaf sections into
 * a dedicated section without removing the originals. `sourceResolverKeys`
 * comes from the section config; items are kept when `journeyTags` includes
 * `"essential"`. Cloned items are reassigned synthetic ids so the renderer
 * doesn't produce duplicate DOM ids, and the cloned item remembers its origin
 * via `_cloneOriginKey` (internal, stripped before emission). */
function resolveEssentials(
  _ctx: GuideContext,
  resolved: ReadonlyMap<GuideResolverKey, GuideItem[]>,
  sourceResolverKeys: readonly GuideResolverKey[],
): GuideItem[] {
  const out: GuideItem[] = [];
  for (const key of sourceResolverKeys) {
    const items = resolved.get(key);
    if (!items) continue;
    for (const item of items) {
      if (!item.journeyTags?.includes("essential")) continue;
      out.push({
        ...item,
        id: `essentials.${key}.${item.id}`,
      });
    }
  }
  return out;
}

type AggregatorResolver = (
  ctx: GuideContext,
  resolved: ReadonlyMap<GuideResolverKey, GuideItem[]>,
  sourceResolverKeys: readonly GuideResolverKey[],
) => GuideItem[];

const AGGREGATOR_RESOLVERS: Partial<Record<GuideResolverKey, AggregatorResolver>> = {
  essentials: resolveEssentials,
};

export function getGuideResolverKeys(): ReadonlyArray<GuideResolverKey> {
  return [
    ...Object.keys(LEAF_RESOLVERS),
    ...Object.keys(AGGREGATOR_RESOLVERS),
  ] as GuideResolverKey[];
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export async function composeGuide(
  propertyId: string,
  audience: GuideAudience,
  publicSlug: string | null,
): Promise<GuideTree> {
  const ctx = await loadGuideContext(propertyId, audience, publicSlug);

  // Pass 1 — leaf resolvers. Emit raw items per resolver key; we keep an
  // unsorted/unfiltered copy so aggregators get the full set (aggregators pick
  // by `journeyTags`, not audience).
  const leafItemsByKey = new Map<GuideResolverKey, GuideItem[]>();
  for (const cfg of SORTED_SECTION_CONFIGS) {
    const resolver = LEAF_RESOLVERS[cfg.resolverKey];
    if (!resolver) continue;
    leafItemsByKey.set(cfg.resolverKey, resolver(ctx));
  }

  // Pass 2 — assemble sections. Aggregators run inline here (they only need
  // `leafItemsByKey`, fully populated by pass 1) so we avoid a second
  // temporary map just to thread the items into the section struct.
  const sections: GuideSection[] = [];
  for (const cfg of SORTED_SECTION_CONFIGS) {
    const aggregator = AGGREGATOR_RESOLVERS[cfg.resolverKey];
    const rawItems = aggregator
      ? aggregator(ctx, leafItemsByKey, cfg.sourceResolverKeys ?? [])
      : leafItemsByKey.get(cfg.resolverKey) ?? [];
    const sorted = applySort(rawItems, cfg.sortBy, cfg.resolverKey);
    const items = filterByAudience(sorted, audience);
    // Host-panel deep links are not exposed to guest audiences (see
    // docs/MASTER_PLAN_V2.md §9A "CTA deep-link"). `maxVisibility` is
    // informational — sections always render and item/field visibility
    // does the real filtering in `filterByAudience`.
    const emptyCtaDeepLink =
      audience === "guest"
        ? null
        : cfg.emptyCtaDeepLink?.replace("{propertyId}", propertyId) ?? null;
    sections.push({
      id: cfg.id,
      label: cfg.label,
      order: cfg.order,
      resolverKey: cfg.resolverKey,
      sortBy: cfg.sortBy,
      emptyCtaDeepLink,
      maxVisibility: cfg.maxVisibility,
      items,
      journeyStage: cfg.journeyStage,
      isHero: cfg.isHero,
      isAggregator: cfg.isAggregator,
      sourceResolverKeys: cfg.sourceResolverKeys as
        | GuideResolverKey[]
        | undefined,
      emptyCopy: cfg.emptyCopy,
    });
  }
  return {
    schemaVersion: GUIDE_TREE_SCHEMA_VERSION,
    propertyId,
    audience,
    generatedAt: new Date().toISOString(),
    sections,
    brandPaletteKey: ctx.property?.brandPaletteKey ?? null,
    brandLogoUrl: ctx.property?.brandLogoUrl ?? null,
  };
}

// Exports for integrity/resilience tests — they need a way to inspect the
// resolver registries without reaching into internals.
export const __test__ = {
  LEAF_RESOLVERS,
  AGGREGATOR_RESOLVERS,
  loadGuideContext,
};
