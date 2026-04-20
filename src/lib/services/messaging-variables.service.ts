// Messaging variable resolution service.
//
// Substitutes `{{variable}}` tokens in a template body against canonical
// property data. Resolution states:
//
//  - `resolved`            variable known + source available + data present.
//  - `missing`             variable known + source available + data absent.
//  - `unknown`             variable not in `taxonomies/messaging_variables.json`
//                          (typos handled via `suggestion`).
//  - `unresolved_context`  variable known but depends on reservation context
//                          not supplied by the caller (filled at send time).
//
// No RAG / LLM / reranker / retriever calls. KnowledgeItem lookups are
// targeted Prisma queries filtered by (entityType, templateKey, tags).

import { prisma } from "@/lib/db";
import {
  KNOWN_MESSAGING_VARIABLES,
  messagingVariables,
  messagingVariablesByToken,
  type MessagingVariableItem,
} from "@/lib/taxonomy-loader";
import { normaliseVisibility } from "@/lib/visibility";
import {
  resolveVariableItem,
  type ContactRow,
  type AmenityInstanceRow,
  type KnowledgeItemRow,
  type PropertyContextRow,
  type ReservationContextRow,
  type ResolverContext,
  type ResolverSourceUsed,
} from "./messaging-variables-resolvers";

// ─── Public API ──────────────────────────────────────────────────────────

export type VariableState =
  | { status: "resolved"; value: string; sourceUsed: ResolverSourceUsed }
  | { status: "missing"; label: string }
  | { status: "unknown"; suggestion: string | null }
  | { status: "unresolved_context"; label: string };

export interface ResolutionResult {
  /** Template body with substitutions applied. */
  output: string;
  /** Per-token state. Key = variable token (not the full `{{var}}`). */
  states: Record<string, VariableState>;
  resolved: string[];
  missing: string[];
  unknown: string[];
  unresolvedContext: string[];
}

export interface ResolveOptions {
  /** Absolute base URL for `{{guide_url}}`. If omitted, returns a path-only
   * value (`/g/<slug>`). Send-time (12B) replaces with the public host. */
  guideBaseUrl?: string | null;
  /** Reservation context. When present, `reservation.*` vars resolve against
   * it; when absent (preview path), they return `unresolved_context`. The
   * materializer (12B) always passes a reservation. */
  reservation?: ReservationContextRow | null;
}

export async function resolveVariables(
  propertyId: string,
  templateBody: string,
  options: ResolveOptions = {},
): Promise<ResolutionResult> {
  const tokens = extractVariableTokens(templateBody);
  if (tokens.length === 0) {
    return {
      output: templateBody,
      states: {},
      resolved: [],
      missing: [],
      unknown: [],
      unresolvedContext: [],
    };
  }

  const { known, unknownTokens } = partitionTokens(tokens);

  // No DB fetch for all-unknown bodies.
  const ctx = known.length > 0
    ? await loadResolverContext(
        propertyId,
        known,
        options.guideBaseUrl ?? null,
        options.reservation ?? null,
      )
    : null;

  const states: Record<string, VariableState> = {};

  for (const token of unknownTokens) {
    states[token] = {
      status: "unknown",
      suggestion: suggestVariable(token),
    };
  }

  if (ctx) {
    for (const item of known) {
      const result = resolveVariableItem(item, ctx);
      if (result.status === "resolved") {
        states[item.variable] = {
          status: "resolved",
          value: result.value,
          sourceUsed: result.sourceUsed,
        };
      } else if (result.status === "missing") {
        states[item.variable] = { status: "missing", label: item.label };
      } else {
        states[item.variable] = {
          status: "unresolved_context",
          label: item.label,
        };
      }
    }
  }

  const output = applySubstitutions(templateBody, states);

  return {
    output,
    states,
    resolved: tokensByStatus(states, "resolved"),
    missing: tokensByStatus(states, "missing"),
    unknown: tokensByStatus(states, "unknown"),
    unresolvedContext: tokensByStatus(states, "unresolved_context"),
  };
}

// ─── Variable token extraction ───────────────────────────────────────────

const TOKEN_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/** Extract unique variable names from a template body. Preserves first-seen
 * order for deterministic iteration. */
export function extractVariableTokens(body: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const match of body.matchAll(TOKEN_REGEX)) {
    const token = match[1];
    if (!seen.has(token)) {
      seen.add(token);
      ordered.push(token);
    }
  }
  return ordered;
}

function partitionTokens(tokens: string[]): {
  known: MessagingVariableItem[];
  unknownTokens: string[];
} {
  const known: MessagingVariableItem[] = [];
  const unknownTokens: string[] = [];
  for (const token of tokens) {
    const item = messagingVariablesByToken.get(token);
    if (item) known.push(item);
    else unknownTokens.push(token);
  }
  return { known, unknownTokens };
}

// ─── Suggestions (Levenshtein) ───────────────────────────────────────────

/** Best matching known variable for an unknown token, or `null` if distance
 * exceeds the threshold. */
export function suggestVariable(token: string): string | null {
  const candidates = [...KNOWN_MESSAGING_VARIABLES];
  const threshold = Math.max(1, Math.min(3, Math.floor(token.length / 3)));
  let best: { name: string; dist: number } | null = null;
  for (const candidate of candidates) {
    const dist = levenshtein(token, candidate);
    if (dist <= threshold && (best === null || dist < best.dist)) {
      best = { name: candidate, dist };
    }
  }
  return best?.name ?? null;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// ─── Output substitution ─────────────────────────────────────────────────

function applySubstitutions(
  body: string,
  states: Record<string, VariableState>,
): string {
  return body.replace(TOKEN_REGEX, (match, token: string) => {
    const state = states[token];
    if (!state) return match;
    if (state.status === "resolved") return state.value;
    if (state.status === "missing") return `[Falta: ${state.label}]`;
    if (state.status === "unresolved_context") return `[${state.label}]`;
    // unknown → keep raw so the host can spot the typo.
    return match;
  });
}

function tokensByStatus(
  states: Record<string, VariableState>,
  status: VariableState["status"],
): string[] {
  return Object.entries(states)
    .filter(([, v]) => v.status === status)
    .map(([k]) => k);
}

// ─── Context loader ──────────────────────────────────────────────────────

async function loadResolverContext(
  propertyId: string,
  known: MessagingVariableItem[],
  guideBaseUrl: string | null,
  reservation: ReservationContextRow | null,
): Promise<ResolverContext> {
  const needed = categorizeNeeds(known);

  const [property, contacts, amenities, knowledge] = await Promise.all([
    prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: {
        id: true,
        propertyNickname: true,
        propertyType: true,
        checkInStart: true,
        checkInEnd: true,
        checkOutTime: true,
        city: true,
        country: true,
        timezone: true,
        streetAddress: true,
        maxGuests: true,
        publicSlug: true,
        accessMethodsJson: true,
        policiesJson: true,
        customAccessMethodDesc: true,
        primaryAccessMethod: true,
        defaultLocale: true,
      },
    }),
    needed.contactRoles.size > 0
      ? prisma.contact.findMany({
          where: {
            propertyId,
            roleKey: { in: [...needed.contactRoles] },
            visibility: { in: ["guest", "ai", "internal"] },
          },
          select: {
            id: true,
            roleKey: true,
            displayName: true,
            phone: true,
            whatsapp: true,
            email: true,
            visibility: true,
            isPrimary: true,
            sortOrder: true,
          },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        })
      : Promise.resolve([]),
    needed.amenityKeys.size > 0
      ? prisma.propertyAmenityInstance.findMany({
          where: {
            propertyId,
            amenityKey: { in: [...needed.amenityKeys] },
            visibility: { in: ["guest", "ai", "internal"] },
          },
          select: {
            id: true,
            amenityKey: true,
            guestInstructions: true,
            detailsJson: true,
            visibility: true,
          },
        })
      : Promise.resolve([]),
    needed.knowledgeFilters.length > 0
      ? prisma.knowledgeItem.findMany({
          where: {
            propertyId,
            visibility: { in: ["guest", "ai", "internal"] },
            OR: needed.knowledgeFilters,
          },
          select: {
            id: true,
            bodyMd: true,
            entityType: true,
            templateKey: true,
            tags: true,
            visibility: true,
            confidenceScore: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const contactsByRole = groupBy(
    contacts.map((c) => ({
      id: c.id,
      roleKey: c.roleKey,
      displayName: c.displayName,
      phone: c.phone,
      whatsapp: c.whatsapp,
      email: c.email,
      visibility: normaliseVisibility(c.visibility),
      isPrimary: c.isPrimary,
      sortOrder: c.sortOrder,
    })) as ContactRow[],
    (c) => c.roleKey,
  );

  const amenitiesByKey = groupBy(
    amenities.map((a) => ({
      id: a.id,
      amenityKey: a.amenityKey,
      guestInstructions: a.guestInstructions,
      detailsJson: a.detailsJson,
      visibility: normaliseVisibility(a.visibility),
    })) as AmenityInstanceRow[],
    (a) => a.amenityKey,
  );

  const knowledgeByTopic = new Map<string, KnowledgeItemRow[]>();
  for (const topic of needed.knowledgeTopics) {
    const spec = KI_TOPIC_SPECS[topic];
    if (!spec) continue;
    const rows = knowledge.filter(spec.matcher).map((k) => ({
      id: k.id,
      bodyMd: k.bodyMd,
      entityType: k.entityType,
      templateKey: k.templateKey,
      tags: k.tags,
      visibility: normaliseVisibility(k.visibility),
      confidenceScore: k.confidenceScore,
    })) as KnowledgeItemRow[];
    knowledgeByTopic.set(topic, rows);
  }

  const propertyRow: PropertyContextRow = {
    id: property.id,
    propertyNickname: property.propertyNickname,
    propertyType: property.propertyType,
    checkInStart: property.checkInStart,
    checkInEnd: property.checkInEnd,
    checkOutTime: property.checkOutTime,
    city: property.city,
    country: property.country,
    timezone: property.timezone,
    streetAddress: property.streetAddress,
    maxGuests: property.maxGuests,
    publicSlug: property.publicSlug,
    accessMethodsJson: property.accessMethodsJson,
    policiesJson: property.policiesJson,
    customAccessMethodDesc: property.customAccessMethodDesc,
    primaryAccessMethod: property.primaryAccessMethod,
    defaultLocale: property.defaultLocale,
  };

  return {
    propertyId,
    property: propertyRow,
    contactsByRole,
    amenitiesByKey,
    knowledgeByTopic,
    guideBaseUrl,
    reservation,
  };
}

interface ResolverNeeds {
  contactRoles: Set<string>;
  amenityKeys: Set<string>;
  knowledgeFilters: KiFilter[];
  knowledgeTopics: Set<string>;
}

function categorizeNeeds(known: MessagingVariableItem[]): ResolverNeeds {
  const contactRoles = new Set<string>();
  const amenityKeys = new Set<string>();
  const knowledgeFilters: KiFilter[] = [];
  const knowledgeTopics = new Set<string>();

  for (const item of known) {
    if (item.source.kind === "contact") {
      contactRoles.add(item.source.roleKey);
      for (const fb of item.source.fallbackRoleKeys ?? []) {
        contactRoles.add(fb);
      }
    } else if (item.source.kind === "knowledge_item") {
      const topic = item.source.topic;
      // Canonical sources — prefetch the underlying amenity rows so the
      // resolver can consult them first.
      const amenityDeps = TOPIC_AMENITY_DEPS[topic];
      if (amenityDeps) {
        for (const k of amenityDeps) amenityKeys.add(k);
      }
      const spec = KI_TOPIC_SPECS[topic];
      if (spec) {
        knowledgeFilters.push(spec.filter);
        knowledgeTopics.add(topic);
      }
    }
  }

  return { contactRoles, amenityKeys, knowledgeFilters, knowledgeTopics };
}

// ─── KI topic → Prisma filter + runtime matcher ──────────────────────────
//
// Single source of truth per topic: Prisma `filter` narrows the findMany
// WHERE; `matcher` re-splits the fetched rows per topic in JS (one query
// covers all topics — split client-side). `TOPIC_AMENITY_DEPS` lists amenity
// keys required by the canonical branch. Topics without KI fallback
// (wifi_*) are absent.

type KiFilter = {
  entityType?: string;
  templateKey?: string | { in: string[] };
  tags?: { hasSome: string[] };
};
type KiRow = {
  entityType: string;
  templateKey: string | null;
  tags: string[];
};
type KiSpec = { filter: KiFilter; matcher: (row: KiRow) => boolean };

function specByTemplateKey(entityType: string, templateKey: string): KiSpec {
  return {
    filter: { entityType, templateKey },
    matcher: (r) => r.entityType === entityType && r.templateKey === templateKey,
  };
}

function specByTemplateKeys(
  entityType: string,
  templateKeys: readonly string[],
): KiSpec {
  return {
    filter: { entityType, templateKey: { in: [...templateKeys] } },
    matcher: (r) =>
      r.entityType === entityType &&
      !!r.templateKey &&
      templateKeys.includes(r.templateKey),
  };
}

function specByTag(tag: string): KiSpec {
  return {
    filter: { tags: { hasSome: [tag] } },
    matcher: (r) => r.tags.includes(tag),
  };
}

const KI_TOPIC_SPECS: Record<string, KiSpec> = {
  pet_policy: specByTemplateKey("policy", "pets"),
  smoking_policy: specByTemplateKey("policy", "smoking"),
  access_instructions: specByTemplateKeys("access", [
    "unit_access",
    "building_access",
    "checkin_logistics",
  ]),
  parking_instructions: specByTag("am.parking"),
};

const TOPIC_AMENITY_DEPS: Record<string, readonly string[]> = {
  wifi_name: ["am.wifi"],
  wifi_password: ["am.wifi"],
  parking_instructions: ["am.parking"],
};

// ─── Utilities ───────────────────────────────────────────────────────────

function groupBy<T, K>(
  arr: T[],
  key: (t: T) => K,
): ReadonlyMap<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

// ─── Re-exports for consumers (validation, UI) ───────────────────────────

export { messagingVariables, messagingVariablesByToken };
