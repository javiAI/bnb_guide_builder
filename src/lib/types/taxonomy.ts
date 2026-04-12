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
  type: "boolean" | "enum" | "enum_multiselect" | "number_optional" | "integer_optional";
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
  | AmenityGroupedFile
  | PolicyGroupedFile
  | SubtypeTaxonomyFile
  | RuleTaxonomyFile;
