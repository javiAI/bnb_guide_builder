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
export interface SubtypeFieldOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface SubtypeField {
  id: string;
  label: string;
  description: string;
  type: string;
  default?: string;
  options?: SubtypeFieldOption[];
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

export interface RuleTaxonomyFile extends TaxonomyFileBase {
  items: DynamicFieldRule[];
}

export type TaxonomyFile =
  | ItemTaxonomyFile
  | AmenityGroupedFile
  | PolicyGroupedFile
  | SubtypeTaxonomyFile
  | RuleTaxonomyFile;
