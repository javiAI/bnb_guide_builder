import type {
  TaxonomyItem,
  TaxonomyOption,
  PolicyItemField,
  AmenityGroup,
  PolicyGroup,
  AmenitySubtype,
  DynamicFieldRule,
  RuleConditionValue,
  ItemTaxonomyFile,
  AmenityGroupedFile,
  PolicyGroupedFile,
  SubtypeTaxonomyFile,
  RuleTaxonomyFile,
  SpaceFeatureGroup,
  SpaceFeaturesFile,
  SpaceTypeItem,
  SpaceTypesTaxonomyFile,
  SpaceAvailabilityRule,
  SpaceAvailabilityRulesFile,
  SystemItem,
  SystemGroup,
  SystemTaxonomyFile,
  SystemSubtype,
  SystemSubtypesTaxonomyFile,
  AmenityScopePolicyEntry,
  AmenityDestination,
} from "./types/taxonomy";
import { evaluateFieldCondition } from "./conditional-engine/evaluator";

import propertyTypesJson from "../../taxonomies/property_types.json";
import roomTypesJson from "../../taxonomies/room_types.json";
import spaceTypesJson from "../../taxonomies/space_types.json";
import accessMethodsJson from "../../taxonomies/access_methods.json";
import policyTaxonomyJson from "../../taxonomies/policy_taxonomy.json";
import amenityTaxonomyJson from "../../taxonomies/amenity_taxonomy.json";
import amenitySubtypesJson from "../../taxonomies/amenity_subtypes.json";
import troubleshootingTaxonomyJson from "../../taxonomies/troubleshooting_taxonomy.json";
import messagingTouchpointsJson from "../../taxonomies/messaging_touchpoints.json";
import guideOutputsJson from "../../taxonomies/guide_outputs.json";
import visibilityLevelsJson from "../../taxonomies/visibility_levels.json";
import mediaRequirementsJson from "../../taxonomies/media_requirements.json";
import dynamicFieldRulesJson from "../../taxonomies/dynamic_field_rules.json";
import automationChannelsJson from "../../taxonomies/automation_channels.json";
import mediaAssetRolesJson from "../../taxonomies/media_asset_roles.json";
import reviewReasonsJson from "../../taxonomies/review_reasons.json";
import bedTypesJson from "../../taxonomies/bed_types.json";
import spanishProvincesJson from "../../taxonomies/spanish_provinces.json";
import buildingAccessMethodsJson from "../../taxonomies/building_access_methods.json";
import contactTypesJson from "../../taxonomies/contact_types.json";
import spaceFeaturesJson from "../../taxonomies/space_features.json";
import spaceAvailabilityRulesJson from "../../taxonomies/space_availability_rules.json";
import systemTaxonomyJson from "../../taxonomies/system_taxonomy.json";
import systemSubtypesJson from "../../taxonomies/system_subtypes.json";
import parkingOptionsJson from "../../taxonomies/parking_options.json";
import accessibilityFeaturesJson from "../../taxonomies/accessibility_features.json";
import propertyEnvironmentsJson from "../../taxonomies/property_environments.json";

// ── Item-based taxonomies ──

export const propertyTypes = propertyTypesJson as unknown as ItemTaxonomyFile;
export const roomTypes = roomTypesJson as unknown as ItemTaxonomyFile;
export const spaceTypes = spaceTypesJson as unknown as SpaceTypesTaxonomyFile;
export const accessMethods = accessMethodsJson as unknown as ItemTaxonomyFile;
export const troubleshootingTaxonomy = troubleshootingTaxonomyJson as unknown as ItemTaxonomyFile;
export const messagingTouchpoints = messagingTouchpointsJson as unknown as ItemTaxonomyFile;
export const guideOutputs = guideOutputsJson as unknown as ItemTaxonomyFile;
export const visibilityLevels = visibilityLevelsJson as unknown as ItemTaxonomyFile;
export const mediaRequirements = mediaRequirementsJson as unknown as ItemTaxonomyFile;
export const automationChannels = automationChannelsJson as unknown as ItemTaxonomyFile;
export const mediaAssetRoles = mediaAssetRolesJson as unknown as ItemTaxonomyFile;
export const reviewReasons = reviewReasonsJson as unknown as ItemTaxonomyFile;
export const bedTypes = bedTypesJson as unknown as ItemTaxonomyFile;
export const spanishProvinces = spanishProvincesJson as unknown as ItemTaxonomyFile;
export const buildingAccessMethods = buildingAccessMethodsJson as unknown as ItemTaxonomyFile;
export const parkingOptions = parkingOptionsJson as unknown as ItemTaxonomyFile;
export const accessibilityFeatures = accessibilityFeaturesJson as unknown as ItemTaxonomyFile;
export const propertyEnvironments = propertyEnvironmentsJson as unknown as ItemTaxonomyFile;
export const contactTypes = contactTypesJson as unknown as import("./types/taxonomy").ContactTypesTaxonomyFile;
export const spaceFeatures = spaceFeaturesJson as unknown as SpaceFeaturesFile;
export const spaceAvailabilityRules = spaceAvailabilityRulesJson as unknown as SpaceAvailabilityRulesFile;
export const systemTaxonomy = systemTaxonomyJson as unknown as SystemTaxonomyFile;
export const systemSubtypes = systemSubtypesJson as unknown as SystemSubtypesTaxonomyFile;

// ── Grouped taxonomies ──

export const amenityTaxonomy = amenityTaxonomyJson as unknown as AmenityGroupedFile;
export const policyTaxonomy = policyTaxonomyJson as unknown as PolicyGroupedFile;

// ── Subtype taxonomy ──

export const amenitySubtypes = amenitySubtypesJson as unknown as SubtypeTaxonomyFile;

// ── Rule taxonomy ──

export const dynamicFieldRules = dynamicFieldRulesJson as unknown as RuleTaxonomyFile;

// ── Item helpers ──

export function getItems(taxonomy: ItemTaxonomyFile): TaxonomyItem[] {
  return taxonomy.items;
}

export function findItem(
  taxonomy: ItemTaxonomyFile,
  id: string,
): TaxonomyItem | undefined {
  return taxonomy.items.find((item) => item.id === id);
}

export function getRecommendedItems(taxonomy: ItemTaxonomyFile): TaxonomyItem[] {
  return taxonomy.items.filter((item) => item.recommended);
}

// ── Space type label helpers ──
// Single source of truth: spaceTypes taxonomy. SPACE_TYPE_LABELS kept for
// backward compatibility at existing call sites — do not add new entries here.

export function getSpaceTypeLabel(id: string, fallback = id): string {
  return getSpaceTypeItem(id)?.label ?? fallback;
}

/** @deprecated Use getSpaceTypeLabel(id) instead — reads from spaceTypes taxonomy */
export const SPACE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  spaceTypes.items.map((s) => [s.id, s.label]),
);

// ── Children age limit ──

export const CHILDREN_AGE_LIMIT = 14;

// ── Amenity group helpers ──

export function getAmenityGroups(taxonomy: AmenityGroupedFile): AmenityGroup[] {
  return taxonomy.groups;
}

export function getAmenityGroupItems(
  taxonomy: AmenityGroupedFile,
  groupId: string,
): TaxonomyItem[] {
  const group = taxonomy.groups.find((g) => g.id === groupId);
  if (!group) return [];
  return group.item_ids
    .map((itemId) => taxonomy.items.find((item) => item.id === itemId))
    .filter((item): item is TaxonomyItem => item !== undefined);
}

// ── Policy group helpers ──

export function getPolicyGroups(taxonomy: PolicyGroupedFile): PolicyGroup[] {
  return taxonomy.groups;
}

export function getPolicyItems(taxonomy: PolicyGroupedFile): TaxonomyItem[] {
  return taxonomy.groups.flatMap((g) => g.items);
}

export function findPolicyItem(itemId: string): TaxonomyItem | undefined {
  return getPolicyItems(policyTaxonomy).find((i) => i.id === itemId);
}

export function getPolicyOptions(itemId: string): TaxonomyOption[] {
  return findPolicyItem(itemId)?.options ?? [];
}

export function getPolicyFieldOptions(itemId: string, fieldId: string): TaxonomyOption[] {
  const item = findPolicyItem(itemId);
  if (!item?.fields) return [];
  const field = item.fields.find((f: PolicyItemField) => f.id === fieldId);
  return field?.options ?? [];
}

// ── Subtype helpers ──

export function findSubtype(
  amenityId: string,
): AmenitySubtype | undefined {
  return amenitySubtypes.subtypes.find((s) => s.amenity_id === amenityId);
}

// ── Space feature helpers ──

export function getSpaceFeatureGroups(spaceTypeId: string): SpaceFeatureGroup[] {
  return spaceFeatures.groups.filter(
    (g) => g.applies_to.includes("*") || g.applies_to.includes(spaceTypeId),
  );
}

// ── Space type metadata helpers ──

export function getSpaceTypeItem(id: string): SpaceTypeItem | undefined {
  return spaceTypes.items.find((s) => s.id === id);
}

export function getSpaceTypesForRoomType(roomTypeId: string): SpaceTypeItem[] {
  return spaceTypes.items.filter((s) => s.applicableRoomTypes.includes(roomTypeId));
}

// ── Space availability rule helpers ──

export function getSpaceAvailabilityRule(
  roomType: string,
  layoutKey: string | null,
): SpaceAvailabilityRule | undefined {
  return spaceAvailabilityRules.rules.find(
    (r) => r.roomType === roomType && r.layout === layoutKey,
  );
}

export function getAvailableSpaceTypes(
  roomType: string,
  layoutKey: string | null,
): { required: string[]; recommended: string[]; optional: string[]; excluded: string[] } {
  const rule = getSpaceAvailabilityRule(roomType, layoutKey);
  if (!rule) return { required: [], recommended: [], optional: [], excluded: [] };
  return {
    required: rule.required,
    recommended: rule.recommended,
    optional: rule.optional,
    excluded: rule.excluded,
  };
}

/** Maps layout keys to the non-bedroom space type they imply (derived from taxonomy derivedByLayoutKeys). */
export const LAYOUT_SPACE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const item of spaceTypes.items) {
    for (const layoutKey of item.derivedByLayoutKeys) {
      map[layoutKey] = item.id;
    }
  }
  return map;
})();

// ── System taxonomy helpers ──

export function getSystemGroups(): SystemGroup[] {
  return systemTaxonomy.groups;
}

const _allSystemItems: ReadonlyArray<SystemItem> = Object.freeze(
  systemTaxonomy.groups.flatMap((g) => g.items),
);

export function getAllSystemItems(): ReadonlyArray<SystemItem> {
  return _allSystemItems;
}

export function findSystemItem(id: string): SystemItem | undefined {
  return getAllSystemItems().find((s) => s.id === id);
}

export function findSystemSubtype(systemKey: string): SystemSubtype | undefined {
  return systemSubtypes.subtypes.find((s) => s.systemKey === systemKey || s.id === systemKey);
}

// ── Amenity item helpers ──

export function findAmenityItem(amenityId: string): TaxonomyItem | undefined {
  return amenityTaxonomy.items.find((i) => i.id === amenityId);
}

/**
 * Returns true if this amenity's primary config lives on a System (canonicalOwner).
 * These amenities show read-only in the amenities section with a link to Systems.
 */
export function isCanonicalOwnerAmenity(amenityId: string): boolean {
  return !!findAmenityItem(amenityId)?.canonicalOwner;
}

/**
 * Partition amenity items by relevance to the given space type IDs.
 * Items with no suggestedSpaceTypes or at least one matching type → relevant.
 * Items whose suggestedSpaceTypes don't overlap → irrelevant.
 * Returns { relevant, irrelevant } so the UI can show irrelevant items in a collapsed section.
 */
export function partitionAmenitiesBySpaces(
  spaceTypeIds: string[],
): { relevant: TaxonomyItem[]; irrelevant: TaxonomyItem[] } {
  const spaceSet = new Set(spaceTypeIds);
  const relevant: TaxonomyItem[] = [];
  const irrelevant: TaxonomyItem[] = [];

  for (const item of amenityTaxonomy.items) {
    const scope = amenityTaxonomy.scopePolicies?.[item.id];
    const suggested = scope?.suggestedSpaceTypes ?? [];

    if (suggested.length === 0 || suggested.some((s) => spaceSet.has(s))) {
      relevant.push(item);
    } else {
      irrelevant.push(item);
    }
  }
  return { relevant, irrelevant };
}

// ── Amenity destination helpers (audit 1B) ──

export function getAmenityDestination(amenityId: string): AmenityDestination | undefined {
  return findAmenityItem(amenityId)?.destination;
}

export function isAmenityConfigurable(amenityId: string): boolean {
  return getAmenityDestination(amenityId) === "amenity_configurable";
}

export function isAmenityDerived(amenityId: string): boolean {
  const d = getAmenityDestination(amenityId);
  return d === "derived_from_space" || d === "derived_from_system" || d === "derived_from_access";
}

export function isAmenityMoved(amenityId: string): boolean {
  const d = getAmenityDestination(amenityId);
  return (
    d === "moved_to_system" ||
    d === "moved_to_access" ||
    d === "moved_to_property_attribute" ||
    d === "moved_to_guide_content"
  );
}

// ── Amenity scope policy helpers ──

export function getAmenityScopePolicy(amenityId: string): AmenityScopePolicyEntry | undefined {
  return amenityTaxonomy.scopePolicies?.[amenityId];
}

// ── Rule helpers ──

export function getRulesForTrigger(trigger: string): DynamicFieldRule[] {
  return dynamicFieldRules.items.filter((rule) => rule.trigger === trigger);
}

export function evaluateRule(
  rule: DynamicFieldRule,
  currentValue: RuleConditionValue,
): boolean {
  // Delegate to the unified conditional engine so form-field visibility and
  // catalog item availability share one operator implementation.
  return evaluateFieldCondition(
    rule.condition as Record<string, unknown>,
    currentValue,
  );
}
