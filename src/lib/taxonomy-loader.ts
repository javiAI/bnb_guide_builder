import type {
  TaxonomyItem,
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
} from "./types/taxonomy";

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

// ── Item-based taxonomies ──

export const propertyTypes = propertyTypesJson as unknown as ItemTaxonomyFile;
export const roomTypes = roomTypesJson as unknown as ItemTaxonomyFile;
export const spaceTypes = spaceTypesJson as unknown as ItemTaxonomyFile;
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
export const contactTypes = contactTypesJson as unknown as { groups: Array<{ id: string; label: string }>; items: Array<{ id: string; label: string; description: string; group: string; recommended: boolean; defaultVisibility: string; defaultEntityType: string }> };

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

// ── Space type labels ──

export const SPACE_TYPE_LABELS: Record<string, string> = {
  "sp.bedroom": "Dormitorio",
  "sp.living_room": "Salón",
  "sp.shared_area": "Zona compartida",
  "sp.office": "Despacho",
  "sp.other": "Otra zona",
};

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

// ── Subtype helpers ──

export function findSubtype(
  amenityId: string,
): AmenitySubtype | undefined {
  return amenitySubtypes.subtypes.find((s) => s.amenity_id === amenityId);
}

// ── Rule helpers ──

export function getRulesForTrigger(trigger: string): DynamicFieldRule[] {
  return dynamicFieldRules.items.filter((rule) => rule.trigger === trigger);
}

export function evaluateRule(
  rule: DynamicFieldRule,
  currentValue: RuleConditionValue,
): boolean {
  if ("equals" in rule.condition) {
    return currentValue === rule.condition.equals;
  }
  if ("contains" in rule.condition) {
    const needle = rule.condition.contains as string;
    if (Array.isArray(currentValue)) {
      return currentValue.includes(needle);
    }
    return currentValue === needle;
  }
  if ("intersects" in rule.condition && Array.isArray(rule.condition.intersects)) {
    if (Array.isArray(currentValue)) {
      return currentValue.some((v) =>
        (rule.condition.intersects as string[]).includes(v),
      );
    }
    return (rule.condition.intersects as string[]).includes(currentValue as string);
  }
  if ("prefix_contains" in rule.condition) {
    const prefix = rule.condition.prefix_contains as string;
    if (Array.isArray(currentValue)) {
      return currentValue.some((v) => typeof v === "string" && v.startsWith(prefix));
    }
    return typeof currentValue === "string" && currentValue.startsWith(prefix);
  }
  return false;
}
