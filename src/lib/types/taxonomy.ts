import type { SubtypeFieldType } from "@/config/registries/field-type-registry";

// Reusable option shape (used by policy items, subtype fields, etc.)
export interface TaxonomyOption {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
  /** Guest-facing label. Used by the presentation layer (rama 10F) so enum
   * keys and internal labels never cross to `audience=guest`. When absent,
   * the presenter falls back to `label` if it looks human, or drops the
   * option from guest output. */
  guestLabel?: string;
  /** Guest-facing short description, shown in expanded detail views. */
  guestDescription?: string;
  /** Optional icon key (matches lucide-react icon names) resolved by the
   * icon registry. Never a URL. */
  icon?: string;
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
  /** Guest-facing field label (rama 10F). */
  guestLabel?: string;
  /** Guest-facing field description — neutral, not host-imperative. */
  guestDescription?: string;
  icon?: string;
}

// Amenity importance classification (maps to OTA categories)
export type ImportanceLevel = "highlight" | "standard" | "bonus";

// Amenity destination classification (audit 1B). Defines where the concept lives:
// - `amenity_configurable`: stays as configurable amenity instance
// - `derived_from_space|system|access`: shown derived, not captured in PropertyAmenityInstance
// - `moved_to_*`: relocated out of Amenities (section target indicated by `target`)
export type AmenityDestination =
  | "amenity_configurable"
  | "derived_from_space"
  | "derived_from_system"
  | "derived_from_access"
  | "moved_to_system"
  | "moved_to_access"
  | "moved_to_property_attribute"
  | "moved_to_guide_content";

/** Guest journey stage (Rama 10E). Declared on amenity/policy/access items so
 * resolvers can route them to the matching guide section (Llegada / Estancia /
 * Salida / Ayuda). Only `essential` journeyTag items are cloned into the
 * `gs.essentials` aggregator. */
export type TaxonomyJourneyStage = "arrival" | "stay" | "checkout" | "help";

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
  /** Amenity audit destination (see AmenityDestination). Populated by scripts/apply-amenity-destinations.ts. */
  destination?: AmenityDestination;
  /** Optional target module/attribute id for moved/derived amenities (e.g. "sys.internet", "parking_options"). */
  target?: string;
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
  // Guest journey routing (Rama 10E)
  journeyStage?: TaxonomyJourneyStage;
  journeyTags?: string[];
  // Guest presentation metadata (Rama 10F)
  /** Guest-facing label — replaces `label` in `audience=guest` rendering.
   * When absent, presenters fall back to `label` if human-readable; otherwise
   * the item is hidden or rendered with the raw presenter (internal-only). */
  guestLabel?: string;
  /** Guest-facing short description. Never editorial host copy ("Añade...",
   * "Completa..."). Informative, neutral, guest-relevant. */
  guestDescription?: string;
  /** Optional icon key (lucide-react name) resolved by icon registry. */
  icon?: string;
}

// Space type item — extends TaxonomyItem with space-specific metadata
export interface SpaceTypeItem extends TaxonomyItem {
  allowsSleeping: boolean;
  isComposite: boolean;
  // A bed is expected in this space for it to be considered "complete".
  // Narrower than `allowsSleeping` (which covers e.g. living rooms that *can*
  // host a bed but don't require one). Drives `bedsConfigured` in scoring.
  expectsBeds?: boolean;
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

export interface SpaceAvailabilityPropertyTypeOverlay {
  propertyType: string;
  promoteToRecommended: string[];
}

export interface SpaceAvailabilityEnvironmentOverlay {
  environment: string;
  promoteToRecommended: string[];
}

export interface SpaceAvailabilityRulesFile extends TaxonomyFileBase {
  layoutKeys: SpaceLayoutKey[];
  rules: SpaceAvailabilityRule[];
  propertyTypeOverlays?: SpaceAvailabilityPropertyTypeOverlay[];
  environmentOverlays?: SpaceAvailabilityEnvironmentOverlay[];
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
  type: SubtypeFieldType;
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

// Amenity item: a TaxonomyItem with a required `destination` (post audit 1B).
export type AmenityItem = TaxonomyItem & {
  destination: AmenityDestination;
  target?: string;
};

// Amenity scope policy (used in amenity_taxonomy.json scopePolicies map)
export type AmenityScopePolicy = "property_only" | "space_only" | "multi_instance" | "derived";

export interface AmenityScopePolicyEntry {
  scopePolicy: AmenityScopePolicy;
  isDerived: boolean;
  suggestedSpaceTypes: string[];
  relevantEnvironments?: string[];
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
  type: SubtypeFieldType;
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
  /** Post-audit 1B: every amenity has a required `destination`. */
  items: AmenityItem[];
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
  /** Guest-facing label for this contact role (rama 10F). Without it, the
   * enum key `ct.*` leaks to guest output. */
  guestLabel?: string;
  guestDescription?: string;
  icon?: string;
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
