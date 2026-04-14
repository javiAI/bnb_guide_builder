// Reusable option shape (used by policy items, subtype fields, etc.)
export interface TaxonomyOption {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
}

// Nested field inside a policy item (e.g., pol.pets → types, fee_mode)
export interface PolicyItemField {
  id: string;
  label: string;
  description: string;
  type: string;
  default?: unknown;
  min?: number;
  max?: number;
  currency?: string;
  shown_if?: { field: string; equals: unknown };
  options?: TaxonomyOption[];
}

// Amenity importance classification (maps to OTA categories)
export type ImportanceLevel = "highlight" | "standard" | "bonus";

// Shared item shape used by most taxonomies
export interface TaxonomyItem {
  id: string;
  label: string;
  description: string;
  parent_id?: string | null;
  recommended?: boolean;
  defaults?: Record<string, string | undefined>;
  dependency_hints?: string[];
  source?: string[];
  // Amenity-specific
  importanceLevel?: ImportanceLevel;
  canonicalOwner?: string;
  // Policy items can have extra fields
  type?: string;
  required?: boolean;
  default_from_field?: string | null;
  sensitivity?: string;
  options?: TaxonomyOption[];
  fields?: PolicyItemField[];
  // Bed types
  sleepingCapacity?: number;
  widthCm?: number;
}

// Space type item — extends TaxonomyItem with space-specific metadata
export interface SpaceTypeItem extends TaxonomyItem {
  allowsSleeping: boolean;
  isComposite: boolean;
  derivedByLayoutKeys: string[];
  mutuallyExclusiveWith: string[];
  applicableRoomTypes: string[];
}

export interface SpaceTypesTaxonomyFile extends TaxonomyFileBase {
  items: SpaceTypeItem[];
}

// Space availability rules (space_availability_rules.json)
export interface SpaceLayoutKey {
  id: string;
  label: string;
  description: string;
}

export interface SpaceAvailabilityRule {
  roomType: string;
  layout: string | null;
  required: string[];
  recommended: string[];
  optional: string[];
  excluded: string[];
  bedroomsMin: number;
  bedroomsMax: number;
  bathroomsMin: number;
  bathroomsMax: number;
}

export interface SpaceAvailabilityRulesFile extends TaxonomyFileBase {
  layoutKeys: SpaceLayoutKey[];
  rules: SpaceAvailabilityRule[];
}

// System taxonomy (system_taxonomy.json)
export type SystemCoverageRule = "all_relevant_spaces" | "selected_spaces" | "property_only";
export type SystemVisibility = "public" | "internal";

export interface SystemItem {
  id: string;
  label: string;
  description: string;
  subtypeKey: string | null;
  defaultCoverageRule: SystemCoverageRule;
  visibility: SystemVisibility;
  recommended: boolean;
  source: string[];
}

export interface SystemGroup {
  id: string;
  label: string;
  items: SystemItem[];
}

export interface SystemTaxonomyFile extends TaxonomyFileBase {
  groups: SystemGroup[];
}

// System subtypes (system_subtypes.json)
export type SystemFieldVisibility = "public" | "internal" | "sensitive";

export interface SystemSubtypeField {
  id: string;
  label: string;
  type: string;
  visibility?: SystemFieldVisibility;
  required: boolean;
  options?: TaxonomyOption[];
}

export interface SystemSubtype {
  id: string;
  systemKey: string;
  label: string;
  detailsFields: SystemSubtypeField[];
  opsFields: SystemSubtypeField[];
}

export interface SystemSubtypesTaxonomyFile extends TaxonomyFileBase {
  subtypes: SystemSubtype[];
}

// Amenity scope policy (used in amenity_taxonomy.json scopePolicies map)
export type AmenityScopePolicy = "property_only" | "space_only" | "multi_instance" | "derived";

export interface AmenityScopePolicyEntry {
  scopePolicy: AmenityScopePolicy;
  isDerived: boolean;
  suggestedSpaceTypes: string[];
}

// Amenity taxonomy groups: reference items by id
export interface AmenityGroup {
  id: string;
  label: string;
  description: string;
  parent_id: string | null;
  item_ids: string[];
}

// Policy taxonomy groups: contain inline items
export interface PolicyGroup {
  id: string;
  label: string;
  description: string;
  parent_id: string | null;
  items: TaxonomyItem[];
}

// Amenity subtype fields (amenity_subtypes.json)
export type SubtypeFieldOption = TaxonomyOption;

export interface SubtypeField {
  id: string;
  label: string;
  description: string;
  type: string;
  default?: string;
  visibility?: "public" | "internal" | "sensitive";
  required?: boolean;
  shown_if?: { field: string; equals?: unknown; in?: unknown[] };
  options?: TaxonomyOption[];
}

export interface AmenitySubtype {
  amenity_id: string;
  label: string;
  description: string;
  fields: SubtypeField[];
}

// Dynamic field rules (dynamic_field_rules.json)
export type RuleConditionValue = string | boolean | string[];

export interface DynamicFieldRule {
  id: string;
  trigger: string;
  condition: Record<string, RuleConditionValue>;
  shown_fields: string[];
  defaults?: Record<string, string>;
  rationale: string;
}

// Base taxonomy file structure
export interface TaxonomyFileBase {
  file: string;
  version: string;
  locale: string;
  units_system: string;
  source_refs?: Record<string, string>;
}

// Taxonomy file variants
export interface ItemTaxonomyFile extends TaxonomyFileBase {
  items: TaxonomyItem[];
}

export interface AmenityGroupedFile extends TaxonomyFileBase {
  groups: AmenityGroup[];
  items: TaxonomyItem[];
  scopePoliciesMeta?: { comment: string };
  scopePolicies?: Record<string, AmenityScopePolicyEntry>;
}

export interface PolicyGroupedFile extends TaxonomyFileBase {
  groups: PolicyGroup[];
}

export interface SubtypeTaxonomyFile extends TaxonomyFileBase {
  subtypes: AmenitySubtype[];
}

export interface ContactTypeGroup {
  id: string;
  label: string;
}

export interface ContactTypeItem {
  id: string;
  label: string;
  description: string;
  group: string;
  recommended: boolean;
  defaultVisibility: string;
  defaultEntityType: string;
}

export interface ContactTypesTaxonomyFile extends TaxonomyFileBase {
  groups: ContactTypeGroup[];
  items: ContactTypeItem[];
}

export interface RuleTaxonomyFile extends TaxonomyFileBase {
  items: DynamicFieldRule[];
}

// Space features taxonomy (space_features.json)

export interface SpaceFeatureField {
  id: string;
  label: string;
  description: string;
  /** Short clarifying text shown as a clickable "?" tooltip in the UI. Only add when the label alone is ambiguous. */
  tooltip?: string;
  type: "boolean" | "enum" | "enum_multiselect" | "number_optional" | "integer_optional" | "text" | "text_chips";
  options?: TaxonomyOption[];
  shown_if?: { field: string; equals: unknown };
  source?: string[];
}

export interface SpaceFeatureGroup {
  id: string;
  label: string;
  description: string;
  applies_to: string[]; // space type IDs, or ["*"] for all
  fields: SpaceFeatureField[];
}

export interface SpaceFeaturesFile extends TaxonomyFileBase {
  groups: SpaceFeatureGroup[];
}

export type TaxonomyFile =
  | ItemTaxonomyFile
  | SpaceTypesTaxonomyFile
  | AmenityGroupedFile
  | PolicyGroupedFile
  | SubtypeTaxonomyFile
  | RuleTaxonomyFile
  | SpaceAvailabilityRulesFile
  | SystemTaxonomyFile
  | SystemSubtypesTaxonomyFile;
