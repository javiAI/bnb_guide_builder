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
  AmenityItem,
} from "./types/taxonomy";
import { z } from "zod";
import { evaluateFieldCondition } from "./conditional-engine/evaluator";
import { canAudienceSee } from "./visibility";
import {
  ENTITY_TYPES,
  type EntityType,
  type JourneyStage,
} from "./types/knowledge";

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
import completenessRulesJson from "../../taxonomies/completeness_rules.json";
import guideSectionsJson from "../../taxonomies/guide_sections.json";
import escalationRulesJson from "../../taxonomies/escalation_rules.json";
import messagingVariablesJson from "../../taxonomies/messaging_variables.json";
import { CONTACT_CHANNELS } from "./contact-actions";

// ── Item-based taxonomies ──

export const propertyTypes = propertyTypesJson as unknown as ItemTaxonomyFile;
export const roomTypes = roomTypesJson as unknown as ItemTaxonomyFile;
export const spaceTypes = spaceTypesJson as unknown as SpaceTypesTaxonomyFile;
export const accessMethods = accessMethodsJson as unknown as ItemTaxonomyFile;
export const troubleshootingTaxonomy = troubleshootingTaxonomyJson as unknown as ItemTaxonomyFile;
export const messagingTouchpoints = messagingTouchpointsJson as unknown as ItemTaxonomyFile;
export const guideOutputs = guideOutputsJson as unknown as ItemTaxonomyFile;
export const visibilityLevelsTaxonomy = visibilityLevelsJson as unknown as ItemTaxonomyFile;
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

// Each section has a fixed, typed shape so downstream consumers can read
// `rule.weights.requiredPresent` with real inference instead of `Record<string, number>`.
// Weights/thresholds are constrained to non-negative integers (thresholds capped at
// 100) and objects are `.strict()` so unknown keys in the JSON fail loudly at boot
// instead of being silently dropped.
const WeightSchema = z.number().int().min(0).finite();
const ThresholdSchema = z.number().int().min(0).max(100).finite();

const SpacesSectionSchema = z.object({
  label: z.string(),
  weights: z
    .object({
      requiredPresent: WeightSchema,
      recommendedPresent: WeightSchema,
      bedsConfigured: WeightSchema,
      amenitiesPlaced: WeightSchema,
      mediaAttached: WeightSchema,
    })
    .strict(),
}).strict();
const AmenitiesSectionSchema = z.object({
  label: z.string(),
  weights: z
    .object({
      coreAmenitiesPresent: WeightSchema,
      subtypeDetailsComplete: WeightSchema,
      placementsResolved: WeightSchema,
    })
    .strict(),
  coreAmenityKeys: z.array(z.string()),
}).strict();
const SystemsSectionSchema = z.object({
  label: z.string(),
  weights: z
    .object({
      recommendedSystemsPresent: WeightSchema,
      systemDetailsComplete: WeightSchema,
    })
    .strict(),
  recommendedSystemKeys: z.array(z.string()),
}).strict();
const ArrivalSectionSchema = z.object({
  label: z.string(),
  weights: z
    .object({
      checkInTimes: WeightSchema,
      checkOutTime: WeightSchema,
      primaryAccessMethod: WeightSchema,
      accessMethodsDetail: WeightSchema,
    })
    .strict(),
}).strict();

const CompletenessRulesSchema = z.object({
  version: z.string(),
  thresholds: z
    .object({
      usableMinScore: ThresholdSchema,
      publishableMinScore: ThresholdSchema,
    })
    .strict(),
  sections: z
    .object({
      spaces: SpacesSectionSchema,
      amenities: AmenitiesSectionSchema,
      systems: SystemsSectionSchema,
      arrival: ArrivalSectionSchema,
    })
    .strict(),
}).strict();

export type CompletenessRulesFile = z.infer<typeof CompletenessRulesSchema>;
export type CompletenessSectionKey = keyof CompletenessRulesFile["sections"];

function loadCompletenessRules(): CompletenessRulesFile {
  const parsed = CompletenessRulesSchema.safeParse(completenessRulesJson);
  if (!parsed.success) {
    // Fail loud at module load — a malformed rules file would otherwise
    // produce NaN scores silently at runtime.
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid taxonomies/completeness_rules.json:\n${details}`,
    );
  }
  return parsed.data;
}

export const completenessRules: CompletenessRulesFile = loadCompletenessRules();

// ── Messaging variables (rama 12A) ──
// Canonical catalog of template variables (`{{var}}`) + the source each one
// resolves from. Adding a variable = JSON entry + resolver registration in
// `src/lib/services/messaging-variables-resolvers.ts`. The coverage test fails
// if an entry lacks a resolver.

export const MV_SEND_POLICIES = [
  "safe_always",
  "sensitive_prearrival",
  "internal_only",
] as const;
export type MessagingVariableSendPolicy = (typeof MV_SEND_POLICIES)[number];

export const MV_PREVIEW_BEHAVIORS = ["resolve", "placeholder"] as const;
export type MessagingVariablePreviewBehavior =
  (typeof MV_PREVIEW_BEHAVIORS)[number];

export const MV_SOURCE_KINDS = [
  "property_field",
  "contact",
  "knowledge_item",
  "derived",
  "reservation",
] as const;
export type MessagingVariableSourceKind = (typeof MV_SOURCE_KINDS)[number];

const MvPropertyFieldSourceSchema = z
  .object({
    kind: z.literal("property_field"),
    path: z.string().min(1),
  })
  .strict();

const MvContactSourceSchema = z
  .object({
    kind: z.literal("contact"),
    roleKey: z.string().min(1),
    fallbackRoleKeys: z.array(z.string().min(1)).optional(),
    field: z.enum(["displayName", "phone", "whatsapp", "email"]),
  })
  .strict();

const MvKnowledgeItemSourceSchema = z
  .object({
    kind: z.literal("knowledge_item"),
    topic: z.string().min(1),
  })
  .strict();

const MvDerivedSourceSchema = z
  .object({
    kind: z.literal("derived"),
    derivation: z.string().min(1),
  })
  .strict();

const MvReservationSourceSchema = z
  .object({
    kind: z.literal("reservation"),
    field: z.string().min(1),
  })
  .strict();

const MvSourceSchema = z.discriminatedUnion("kind", [
  MvPropertyFieldSourceSchema,
  MvContactSourceSchema,
  MvKnowledgeItemSourceSchema,
  MvDerivedSourceSchema,
  MvReservationSourceSchema,
]);

const VARIABLE_TOKEN = /^[a-z][a-z0-9_]*$/;

const MvItemSchema = z
  .object({
    id: z.string().regex(/^mv\.[a-z][a-z0-9_]*$/, "id must match mv.<token>"),
    variable: z
      .string()
      .regex(VARIABLE_TOKEN, "variable must be snake_case"),
    label: z.string().min(1),
    description: z.string().min(1),
    group: z.string().min(1),
    source: MvSourceSchema,
    sendPolicy: z.enum(MV_SEND_POLICIES),
    previewBehavior: z.enum(MV_PREVIEW_BEHAVIORS),
    example: z.string().min(1),
  })
  .strict();

const MvGroupSchema = z
  .object({ id: z.string().min(1), label: z.string().min(1) })
  .strict();

const MessagingVariablesSchema = z
  .object({
    file: z.literal("messaging_variables.json"),
    version: z.string().min(1),
    locale: z.string().min(1),
    units_system: z.string().min(1).optional(),
    groups: z.array(MvGroupSchema).min(1),
    items: z.array(MvItemSchema).min(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    const groupIds = new Set(data.groups.map((g) => g.id));
    const seenVariables = new Set<string>();
    const seenIds = new Set<string>();
    data.items.forEach((item, idx) => {
      if (!groupIds.has(item.group)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", idx, "group"],
          message: `Unknown group "${item.group}"`,
        });
      }
      if (seenIds.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", idx, "id"],
          message: `Duplicate id "${item.id}"`,
        });
      }
      seenIds.add(item.id);
      if (seenVariables.has(item.variable)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", idx, "variable"],
          message: `Duplicate variable "${item.variable}"`,
        });
      }
      seenVariables.add(item.variable);
      if (
        item.source.kind === "reservation" &&
        item.previewBehavior !== "placeholder"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", idx, "previewBehavior"],
          message:
            "reservation vars must declare previewBehavior=placeholder (12A)",
        });
      }
    });
  });

export type MessagingVariablesFile = z.infer<typeof MessagingVariablesSchema>;
export type MessagingVariableItem = MessagingVariablesFile["items"][number];
export type MessagingVariableGroup = MessagingVariablesFile["groups"][number];
export type MessagingVariableSource = MessagingVariableItem["source"];

function loadMessagingVariables(): MessagingVariablesFile {
  const parsed = MessagingVariablesSchema.safeParse(messagingVariablesJson);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid taxonomies/messaging_variables.json:\n${details}`,
    );
  }
  return parsed.data;
}

export const messagingVariables: MessagingVariablesFile =
  loadMessagingVariables();

/** Map `variable` → item for O(1) lookup in the resolver. */
export const messagingVariablesByToken: ReadonlyMap<
  string,
  MessagingVariableItem
> = new Map(messagingVariables.items.map((i) => [i.variable, i]));

/** Known variable tokens (the set of legal `{{var}}` names). */
export const KNOWN_MESSAGING_VARIABLES: ReadonlySet<string> = new Set(
  messagingVariables.items.map((i) => i.variable),
);

// ── Guide sections (rama 9A) ──
// Resolver keys are declared here (mirror of the resolvers registered in
// guide-rendering.service.ts). A resolver key used in guide_sections.json that
// doesn't appear below is rejected at boot. The integrity test
// `guide-sections-coverage.test.ts` keeps this list and the service resolvers
// in lockstep.
export const GUIDE_RESOLVER_KEYS = [
  "essentials",
  "arrival",
  "spaces",
  "howto",
  "amenities",
  "rules",
  "checkout",
  "local",
  "emergency",
] as const;
export type GuideResolverKey = (typeof GUIDE_RESOLVER_KEYS)[number];

export const GUIDE_SORT_BY = [
  "taxonomy_order",
  "recommended_first",
  "alpha",
  "explicit_order",
] as const;
export type GuideSortBy = (typeof GUIDE_SORT_BY)[number];

export const GUIDE_AUDIENCES = ["guest", "ai", "internal", "sensitive"] as const;
export type GuideAudience = (typeof GUIDE_AUDIENCES)[number];

export const GUIDE_JOURNEY_STAGES = [
  "arrival",
  "stay",
  "checkout",
  "help",
] as const;
export type GuideJourneyStage = (typeof GUIDE_JOURNEY_STAGES)[number];

const GUIDE_JOURNEY_STAGE_LABELS: Record<GuideJourneyStage, string> = {
  arrival: "Llegada",
  stay: "Estancia",
  checkout: "Salida",
  help: "Ayuda",
};

export function getJourneyStageLabel(stage: GuideJourneyStage): string {
  return GUIDE_JOURNEY_STAGE_LABELS[stage];
}

/** Contact role keys that represent the host / co-host. Used by the help
 * section to promote host contacts alongside emergency-flagged ones. */
const HOST_CONTACT_ROLE_KEYS: ReadonlySet<string> = new Set([
  "ct.host",
  "ct.cohost",
]);

export function isHostRole(roleKey: string): boolean {
  return HOST_CONTACT_ROLE_KEYS.has(roleKey);
}

const GuideSectionConfigSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    order: z.number().int().min(0),
    maxVisibility: z.enum(GUIDE_AUDIENCES),
    sortBy: z.enum(GUIDE_SORT_BY),
    resolverKey: z.enum(GUIDE_RESOLVER_KEYS),
    emptyCtaDeepLink: z.string().min(1).nullable(),
    includesMedia: z.boolean(),
    offlineCacheTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    journeyStage: z.enum(GUIDE_JOURNEY_STAGES).optional(),
    isHero: z.boolean().optional(),
    isAggregator: z.boolean().optional(),
    sourceResolverKeys: z.array(z.enum(GUIDE_RESOLVER_KEYS)).optional(),
    quickActionKeys: z.array(z.string().min(1)).optional(),
    emptyCopy: z.string().min(1).optional(),
    emptyCopyGuest: z.string().min(1).optional(),
    hideWhenEmptyForGuest: z.boolean().optional(),
    searchableKeywords: z.array(z.string().min(1)).optional(),
    entityTypes: z.array(z.enum(ENTITY_TYPES)),
  })
  .strict()
  .refine(
    (s) => !s.isAggregator || (s.sourceResolverKeys?.length ?? 0) > 0,
    {
      message:
        "Aggregator sections must declare `sourceResolverKeys` with at least one resolver key.",
      path: ["sourceResolverKeys"],
    },
  );

const GuideSectionsFileSchema = z
  .object({
    file: z.string(),
    version: z.string(),
    locale: z.string(),
    units_system: z.string(),
    items: z.array(GuideSectionConfigSchema).min(1),
  })
  .strict();

export type GuideSectionConfig = z.infer<typeof GuideSectionConfigSchema>;
export type GuideSectionsFile = z.infer<typeof GuideSectionsFileSchema>;

function loadGuideSections(): GuideSectionsFile {
  const parsed = GuideSectionsFileSchema.safeParse(guideSectionsJson);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid taxonomies/guide_sections.json:\n${details}`);
  }
  // Reject duplicate ids / resolverKeys — both must be unique so the tree and
  // the resolver registry are bijective.
  const ids = new Set<string>();
  const resolverKeys = new Set<string>();
  for (const item of parsed.data.items) {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate guide section id: ${item.id}`);
    }
    ids.add(item.id);
    if (resolverKeys.has(item.resolverKey)) {
      throw new Error(
        `Duplicate guide section resolverKey: ${item.resolverKey}`,
      );
    }
    resolverKeys.add(item.resolverKey);
  }
  // Exhaustiveness: every KnowledgeItem `entityType` must map to at least one
  // non-aggregator section, otherwise the public semantic search (rama 11F)
  // cannot resolve a hit to a GuideTree anchor. Aggregators are excluded so
  // hits land on their canonical home, not on a facade section.
  const claimed = new Set<EntityType>();
  for (const item of parsed.data.items) {
    if (item.isAggregator) continue;
    for (const t of item.entityTypes) claimed.add(t);
  }
  const missing = ENTITY_TYPES.filter((t) => !claimed.has(t));
  if (missing.length > 0) {
    throw new Error(
      `guide_sections.json: entityTypes[] is not exhaustive — missing ${missing.join(
        ", ",
      )}. Every KnowledgeItem.entityType must be claimed by at least one non-aggregator section.`,
    );
  }
  return parsed.data;
}

export const guideSections: GuideSectionsFile = loadGuideSections();

export function getGuideSectionConfigs(): ReadonlyArray<GuideSectionConfig> {
  return guideSections.items;
}

export function getGuideSectionConfig(
  sectionId: string,
): GuideSectionConfig | undefined {
  return guideSections.items.find((s) => s.id === sectionId);
}

export function getGuideSectionByResolverKey(
  key: GuideResolverKey,
): GuideSectionConfig {
  const found = guideSections.items.find((s) => s.resolverKey === key);
  if (!found) {
    throw new Error(
      `No guide section declared for resolverKey "${key}". ` +
        `Known resolver keys: ${GUIDE_RESOLVER_KEYS.join(", ")}.`,
    );
  }
  return found;
}

function findNonAggregatorSectionByResolverKey(key: string): string | null {
  const section = guideSections.items.find(
    (s) => s.resolverKey === key && !s.isAggregator,
  );
  return section ? section.id : null;
}

// `entityType="property"` covers chunks across the whole guide surface
// (check-in time, capacity, overview, checkout time, …) and the generic
// `entityTypes[]` mapping routes them to Amenities by default. Chunks
// carrying `journeyStage` belong elsewhere: `pre_arrival` → Arrival,
// `checkout` → Checkout. Other entityTypes already live in their own
// sections, so we only apply this override for `property`.
//
// Journey stage `checkout` also globally re-homes hits from `gs.rules` to
// `gs.checkout` because the UX groups checkout policies under the Salida card
// regardless of declared entityType.
export function getSectionIdForEntity(
  entityType: EntityType,
  journeyStage: JourneyStage | null | undefined,
): string | null {
  if (entityType === "property") {
    if (journeyStage === "pre_arrival") {
      const arrival = findNonAggregatorSectionByResolverKey("arrival");
      if (arrival) return arrival;
    }
    if (journeyStage === "checkout") {
      const checkout = findNonAggregatorSectionByResolverKey("checkout");
      if (checkout) return checkout;
    }
  }
  if (journeyStage === "checkout") {
    const checkout = findNonAggregatorSectionByResolverKey("checkout");
    if (checkout) return checkout;
  }
  for (const section of guideSections.items) {
    if (section.isAggregator) continue;
    if (section.entityTypes.includes(entityType)) return section.id;
  }
  return null;
}

// ── Visibility hierarchy (rama 9A) ──
// Visibility ordering and `canAudienceSee` live in `src/lib/visibility.ts`
// as the single source of truth. `isVisibleForAudience` is a thin wrapper
// that additionally enforces the Rama 9A hard rule: `sensitive` items are
// never included in a `GuideTree`, regardless of audience.
export function isVisibleForAudience(
  itemVisibility: GuideAudience,
  audience: GuideAudience,
): boolean {
  if (itemVisibility === "sensitive") return false;
  return canAudienceSee(audience, itemVisibility);
}

export function getCompletenessRule<K extends CompletenessSectionKey>(
  sectionKey: K,
): CompletenessRulesFile["sections"][K] {
  // hasOwn (not `if (!rule)`) because prototype keys like "__proto__" or
  // "toString" resolve to truthy values through the prototype chain and would
  // otherwise bypass the guard, returning a non-rule object that silently
  // produces NaN scores downstream.
  if (!Object.prototype.hasOwnProperty.call(completenessRules.sections, sectionKey)) {
    throw new Error(
      `Unknown completeness section "${String(sectionKey)}". ` +
        `Expected one of: ${Object.keys(completenessRules.sections).join(", ")}.`,
    );
  }
  return completenessRules.sections[sectionKey];
}

// ── Escalation rules (rama 11D) ──
// Declarative mapping `intent → contactRoles[]` consumed by the assistant
// escalation service. Keeps routing decisions out of code. Boot validation
// enforces that (a) every referenced `ct.*` key exists in contact_types.json,
// (b) intent ids are unique, and (c) channel priorities only name registered
// contact channels (tel/whatsapp/email).

const EscalationMatchKeywordsSchema = z
  .object({
    es: z.array(z.string().min(1)),
    en: z.array(z.string().min(1)),
  })
  .strict();

const EscalationChannelSchema = z.enum(CONTACT_CHANNELS);

const EscalationIntentSchema = z
  .object({
    id: z.string().regex(/^int\.[a-z][a-z0-9_]*$/),
    label: z.string().min(1),
    contactRoles: z.array(z.string().regex(/^ct\./)).min(1),
    fallbackToHost: z.boolean(),
    emergencyPriority: z.boolean(),
    channelPriority: z.array(EscalationChannelSchema).min(1),
    matchKeywords: EscalationMatchKeywordsSchema,
  })
  .strict();

const EscalationFallbackSchema = z
  .object({
    id: z.string().min(1),
    intentId: z.string().regex(/^int\./),
    contactRoles: z.array(z.string().regex(/^ct\./)).min(1),
    channelPriority: z.array(EscalationChannelSchema).min(1),
  })
  .strict();

const EscalationRulesFileSchema = z
  .object({
    file: z.string(),
    version: z.string(),
    locale: z.string(),
    units_system: z.string(),
    fallback: EscalationFallbackSchema,
    intents: z.array(EscalationIntentSchema).min(1),
  })
  .strict();

export type EscalationChannel = z.infer<typeof EscalationChannelSchema>;
export type EscalationIntent = z.infer<typeof EscalationIntentSchema>;
export type EscalationIntentId = EscalationIntent["id"];
export type EscalationFallback = z.infer<typeof EscalationFallbackSchema>;
export type EscalationRulesFile = z.infer<typeof EscalationRulesFileSchema>;

function loadEscalationRules(): EscalationRulesFile {
  const parsed = EscalationRulesFileSchema.safeParse(escalationRulesJson);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid taxonomies/escalation_rules.json:\n${details}`);
  }
  const data = parsed.data;

  // Cross-taxonomy integrity — every ct.* referenced must exist in contact_types.json.
  const knownRoles = new Set(contactTypes.items.map((c) => c.id));
  const checkRole = (role: string, path: string) => {
    if (!knownRoles.has(role)) {
      throw new Error(
        `escalation_rules.json references unknown contact role "${role}" at ${path}. ` +
          `Must exist in contact_types.json.`,
      );
    }
  };
  for (const role of data.fallback.contactRoles) {
    checkRole(role, "fallback.contactRoles");
  }
  for (const intent of data.intents) {
    for (const role of intent.contactRoles) {
      checkRole(role, `intents[${intent.id}].contactRoles`);
    }
  }

  // Intent id uniqueness.
  const seen = new Set<string>();
  for (const intent of data.intents) {
    if (seen.has(intent.id)) {
      throw new Error(`Duplicate escalation intent id: ${intent.id}`);
    }
    seen.add(intent.id);
  }

  // The fallback intent id must match one of the declared intents so the
  // resolver can look up its rule if needed.
  if (!seen.has(data.fallback.intentId)) {
    throw new Error(
      `Fallback intentId "${data.fallback.intentId}" is not declared in intents[].`,
    );
  }

  return data;
}

export const escalationRules: EscalationRulesFile = loadEscalationRules();

export function getEscalationIntents(): ReadonlyArray<EscalationIntent> {
  return escalationRules.intents;
}

export function getEscalationFallback(): EscalationFallback {
  return escalationRules.fallback;
}

export function findEscalationIntent(
  intentId: string,
): EscalationIntent | undefined {
  return escalationRules.intents.find((i) => i.id === intentId);
}

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
): AmenityItem[] {
  const group = taxonomy.groups.find((g) => g.id === groupId);
  if (!group) return [];
  return group.item_ids
    .map((itemId) => taxonomy.items.find((item) => item.id === itemId))
    .filter((item): item is AmenityItem => item !== undefined);
}

// ── Policy group helpers ──

export function getPolicyGroups(taxonomy: PolicyGroupedFile): PolicyGroup[] {
  return taxonomy.groups;
}

export function getPolicyItems(taxonomy: PolicyGroupedFile): TaxonomyItem[] {
  return taxonomy.groups.flatMap((g) => g.items);
}

const POLICY_ITEM_BY_ID: ReadonlyMap<string, TaxonomyItem> = new Map(
  getPolicyItems(policyTaxonomy).map((i) => [i.id, i]),
);

export function findPolicyItem(itemId: string): TaxonomyItem | undefined {
  return POLICY_ITEM_BY_ID.get(itemId);
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

const _subtypesByAmenityId: ReadonlyMap<string, AmenitySubtype> = new Map(
  amenitySubtypes.subtypes.map((s) => [s.amenity_id, s]),
);
export function findSubtype(
  amenityId: string,
): AmenitySubtype | undefined {
  return _subtypesByAmenityId.get(amenityId);
}

// ── Space feature helpers ──

export function getSpaceFeatureGroups(spaceTypeId: string): SpaceFeatureGroup[] {
  return spaceFeatures.groups.filter(
    (g) => g.applies_to.includes("*") || g.applies_to.includes(spaceTypeId),
  );
}

// ── Space type metadata helpers ──

const _spaceTypesById: ReadonlyMap<string, SpaceTypeItem> = new Map(
  spaceTypes.items.map((s) => [s.id, s]),
);
export function getSpaceTypeItem(id: string): SpaceTypeItem | undefined {
  return _spaceTypesById.get(id);
}

export function getSpaceTypesForRoomType(roomTypeId: string): SpaceTypeItem[] {
  return spaceTypes.items.filter((s) => s.applicableRoomTypes.includes(roomTypeId));
}

// Space types flagged as needing beds for completeness (expectsBeds=true).
// Memoized on first call — the taxonomy is immutable at runtime. Return type
// is `ReadonlySet` so callers can't mutate the shared cached instance.
let _spaceTypesWithExpectedBeds: Set<string> | null = null;
export function getSpaceTypesWithExpectedBeds(): ReadonlySet<string> {
  if (_spaceTypesWithExpectedBeds === null) {
    _spaceTypesWithExpectedBeds = new Set(
      spaceTypes.items.filter((s) => s.expectsBeds === true).map((s) => s.id),
    );
  }
  return _spaceTypesWithExpectedBeds;
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

const _systemItemsById: ReadonlyMap<string, SystemItem> = new Map(
  _allSystemItems.map((s) => [s.id, s]),
);
export function findSystemItem(id: string): SystemItem | undefined {
  return _systemItemsById.get(id);
}

const _systemSubtypesByKey: ReadonlyMap<string, SystemSubtype> = (() => {
  const map = new Map<string, SystemSubtype>();
  for (const s of systemSubtypes.subtypes) {
    map.set(s.systemKey, s);
    if (s.id !== s.systemKey) map.set(s.id, s);
  }
  return map;
})();
export function findSystemSubtype(systemKey: string): SystemSubtype | undefined {
  return _systemSubtypesByKey.get(systemKey);
}

// ── Amenity item helpers ──

const _amenityItemsById: ReadonlyMap<string, AmenityItem> = new Map(
  amenityTaxonomy.items.map((i) => [i.id, i]),
);
export function findAmenityItem(amenityId: string): AmenityItem | undefined {
  return _amenityItemsById.get(amenityId);
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

// Returns false iff the amenity's scopePolicy is "property_only" (the amenity
// is property-wide and needs no per-space placement). Unknown keys default to
// requiring placement so amenities outside the taxonomy don't get free credit.
export function amenityRequiresPlacement(amenityId: string): boolean {
  return getAmenityScopePolicy(amenityId)?.scopePolicy !== "property_only";
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
