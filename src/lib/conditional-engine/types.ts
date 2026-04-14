/**
 * Conditional engine — unified DSL for:
 *  - item availability (spaces / systems / amenities / policies / contacts catalogs)
 *  - field visibility (form-level revelation of sub-fields)
 *
 * Spec: docs/deep_research_2/sync_contracts.md
 */

export type Primitive = string | number | boolean | null;

export type OperatorPredicate = {
  equals?: Primitive;
  in?: Primitive[];
  notIn?: Primitive[];
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  exists?: boolean;
  truthy?: boolean;
  falsy?: boolean;
  containsAny?: Primitive[];
  containsAll?: Primitive[];
};

/**
 * Atomic condition: a map of path → predicate.
 * The path is resolved against PropertyContext (for item availability) or
 * form state (for field visibility).
 *
 * Convenience keys: `propertyType`, `roomType`, `propertyFields.<name>` are
 * resolved to their canonical slots in PropertyContext.
 */
export type AtomicCondition = {
  propertyType?: OperatorPredicate;
  roomType?: OperatorPredicate;
  layoutKey?: OperatorPredicate;
  propertyEnvironment?: OperatorPredicate;
  propertyFields?: Record<string, OperatorPredicate | Primitive | Primitive[] | boolean>;
  requiresSpaces?: string[];
  requiresSystems?: string[];
  requiresAmenities?: string[];
};

/**
 * Composable rule.  `allOf` / `anyOf` / `not` can nest freely.
 * Keys not in the combinator set are treated as atomic conditions (AND-joined).
 */
export type ItemRules = AtomicCondition & {
  allOf?: ItemRules[];
  anyOf?: ItemRules[];
  not?: ItemRules;
};

export type PropertyContext = {
  property: {
    id: string;
    propertyType?: string | null;
    roomType?: string | null;
    layoutKey?: string | null;
    propertyEnvironment?: string | null;
    floorLevel?: number | null;
    hasElevator?: boolean | null;
    maxGuests?: number | null;
    maxAdults?: number | null;
    maxChildren?: number | null;
    infantsAllowed?: boolean | null;
    [key: string]: unknown;
  };
  spaces: Array<{ id: string; spaceType: string }>;
  systems: string[]; // active systemKeys
  amenities: string[]; // active amenityKeys
};

export type EvaluationResult = {
  available: boolean;
  reasons: string[];
};
