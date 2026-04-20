// Private resolvers for messaging template variables.
//
// One resolver per `source.kind` declared in taxonomies/messaging_variables.json.
// Resolvers are pure, synchronous functions over a pre-fetched `ResolverContext`
// — the service batches all DB reads upstream so the resolution loop is O(N).
//
// Contract:
// - Never call the assistant RAG pipeline (retriever/reranker/synthesizer/LLM).
// - `knowledge_item` resolvers try the canonical source first, fall back to a
//   targeted `KnowledgeItem` query, and only return short values — long
//   narrative text only if no other option.
// - Reservation resolvers resolve when `ResolverContext.reservation` is
//   present; otherwise they return `unresolved_context` (preview without
//   reservation context, e.g. before a booking exists).
// - Visibility: never surface data whose source visibility exceeds `internal`.
//   Templates themselves are `visibility=internal`, so variable data can reach
//   that tier but `sensitive` is opaque to this service.

import type { Prisma } from "@prisma/client";
import type {
  MessagingVariableItem,
  MessagingVariableSourceKind,
} from "@/lib/taxonomy-loader";
import { canAudienceSee, type VisibilityLevel } from "@/lib/visibility";

// ─── Context shape (filled by the service) ───────────────────────────────

export interface PropertyContextRow {
  id: string;
  propertyNickname: string;
  propertyType: string | null;
  checkInStart: string | null;
  checkInEnd: string | null;
  checkOutTime: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  streetAddress: string | null;
  maxGuests: number | null;
  publicSlug: string | null;
  accessMethodsJson: Prisma.JsonValue | null;
  policiesJson: Prisma.JsonValue | null;
  customAccessMethodDesc: string | null;
  primaryAccessMethod: string | null;
  defaultLocale: string;
}

export interface ContactRow {
  id: string;
  roleKey: string;
  displayName: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  visibility: VisibilityLevel;
  isPrimary: boolean;
  sortOrder: number;
}

export interface AmenityInstanceRow {
  id: string;
  amenityKey: string;
  guestInstructions: string | null;
  detailsJson: Prisma.JsonValue | null;
  visibility: VisibilityLevel;
}

export interface KnowledgeItemRow {
  id: string;
  bodyMd: string;
  entityType: string;
  templateKey: string | null;
  tags: string[];
  visibility: VisibilityLevel;
  confidenceScore: number;
}

export interface ReservationContextRow {
  id: string;
  guestName: string;
  /** ISO calendar date (YYYY-MM-DD). Formatting happens in the resolver,
   * using `Property.timezone` and the property's default locale. */
  checkInDate: Date;
  checkOutDate: Date;
  numGuests: number;
  locale: string | null;
}

export interface ResolverContext {
  propertyId: string;
  property: PropertyContextRow;
  contactsByRole: ReadonlyMap<string, ContactRow[]>;
  amenitiesByKey: ReadonlyMap<string, AmenityInstanceRow[]>;
  knowledgeByTopic: ReadonlyMap<string, KnowledgeItemRow[]>;
  guideBaseUrl: string | null;
  /** Optional reservation context. When absent, `reservation` vars return
   * `unresolved_context`. Used by (a) preview without a reservation, and
   * (b) the materializer which always passes a reservation. */
  reservation: ReservationContextRow | null;
}

// ─── Resolver result ─────────────────────────────────────────────────────

export type ResolverResult =
  | { status: "resolved"; value: string; sourceUsed: ResolverSourceUsed }
  | { status: "missing" }
  | { status: "unresolved_context" };

export type ResolverSourceUsed =
  | "canonical"
  | "knowledge_item"
  | "derived"
  | "contact";

// ─── Helpers ─────────────────────────────────────────────────────────────

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function byPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (cur, key) =>
        cur && typeof cur === "object" && !Array.isArray(cur)
          ? (cur as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

/** Best KnowledgeItem for a topic: highest confidence, visibility ≤ internal. */
function pickKnowledgeItem(
  items: KnowledgeItemRow[] | undefined,
): KnowledgeItemRow | null {
  if (!items || items.length === 0) return null;
  const visible = items.filter((i) => canAudienceSee("internal", i.visibility));
  if (visible.length === 0) return null;
  return [...visible].sort(
    (a, b) => b.confidenceScore - a.confidenceScore,
  )[0];
}

function pickContact(
  roleKey: string,
  fallbackRoles: readonly string[] | undefined,
  ctx: ResolverContext,
): ContactRow | null {
  const roles = [roleKey, ...(fallbackRoles ?? [])];
  for (const role of roles) {
    const rows = ctx.contactsByRole.get(role);
    const visible = (rows ?? []).filter((c) =>
      canAudienceSee("internal", c.visibility),
    );
    if (visible.length > 0) {
      return [...visible].sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      })[0];
    }
  }
  return null;
}

/** Allow-list of direct Property columns a JSON `path` may reference. Prevents
 * taxonomy authors from projecting arbitrary fields (e.g. internal notes).
 * `checkInWindow` is virtual — composed from checkInStart + checkInEnd. */
export const PROPERTY_FIELD_ALLOWLIST = new Set<string>([
  "propertyNickname",
  "checkInStart",
  "checkInEnd",
  "checkOutTime",
  "city",
  "country",
  "timezone",
  "streetAddress",
  "maxGuests",
  "checkInWindow",
]);

// ─── Canonical renderers for P3 knowledge-style variables ────────────────

type CanonicalFn = (ctx: ResolverContext) => string | null;

interface PoliciesShape {
  smoking?: string | null;
  pets?: {
    allowed?: boolean;
    types?: string[];
    maxCount?: number | null;
    sizeRestriction?: string | null;
    notes?: string | null;
  } | null;
}

function parsePolicies(raw: unknown): PoliciesShape | null {
  if (!raw) return null;
  const parsed = typeof raw === "string" ? safeJson(raw) : raw;
  return parsed && typeof parsed === "object"
    ? (parsed as PoliciesShape)
    : null;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const SMOKING_LABELS_ES: Record<string, string> = {
  not_allowed: "No se permite fumar en el interior.",
  outdoors_only: "Solo se permite fumar en zonas exteriores.",
  designated_area: "Solo se permite fumar en la zona designada.",
  no_restriction: "Sin restricciones para fumar.",
};

const CANONICAL_RENDERERS: Record<string, CanonicalFn> = {
  wifi_name: (ctx) => {
    const wifi = ctx.amenitiesByKey.get("am.wifi")?.[0];
    const ssid = wifi ? byPath(wifi.detailsJson, "ssid") : null;
    return nonEmpty(ssid) ? ssid : null;
  },
  wifi_password: (ctx) => {
    const wifi = ctx.amenitiesByKey.get("am.wifi")?.[0];
    const pw = wifi ? byPath(wifi.detailsJson, "password") : null;
    return nonEmpty(pw) ? pw : null;
  },
  smoking_policy: (ctx) => {
    const pol = parsePolicies(ctx.property.policiesJson);
    if (!pol?.smoking) return null;
    return (
      SMOKING_LABELS_ES[pol.smoking] ??
      `Política de fumar: ${pol.smoking.replace(/_/g, " ")}.`
    );
  },
  pet_policy: (ctx) => {
    const pol = parsePolicies(ctx.property.policiesJson);
    const pets = pol?.pets;
    if (!pets) return null;
    if (!pets.allowed) {
      return `No se admiten mascotas en ${ctx.property.propertyNickname}.`;
    }
    const types =
      pets.types && pets.types.length > 0 ? pets.types.join(", ") : "mascotas";
    const countNote = pets.maxCount ? ` (máximo ${pets.maxCount})` : "";
    let text = `Se admiten ${types}${countNote} en ${ctx.property.propertyNickname}.`;
    if (nonEmpty(pets.notes)) text += ` ${pets.notes}`;
    return text;
  },
  access_instructions: (ctx) => {
    const raw = ctx.property.accessMethodsJson;
    const parsed = typeof raw === "string" ? safeJson(raw) : raw;
    if (Array.isArray(parsed)) {
      const parts: string[] = [];
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object") continue;
        const rec = entry as Record<string, unknown>;
        const instructions = rec.instructions ?? rec.details ?? rec.notes;
        if (nonEmpty(instructions)) parts.push(instructions);
      }
      if (parts.length > 0) return parts.join("\n\n");
    }
    if (nonEmpty(ctx.property.customAccessMethodDesc)) {
      return ctx.property.customAccessMethodDesc;
    }
    return null;
  },
  parking_instructions: (ctx) => {
    const parking = ctx.amenitiesByKey.get("am.parking")?.[0];
    if (parking && nonEmpty(parking.guestInstructions)) {
      return parking.guestInstructions;
    }
    return null;
  },
};

/** Short-value variables: KI fallback disabled (KI bodies are narrative). */
const SHORT_VALUE_VARIABLES: ReadonlySet<string> = new Set([
  "wifi_name",
  "wifi_password",
]);

// ─── Resolvers per source.kind ───────────────────────────────────────────

type Resolver = (
  item: MessagingVariableItem,
  ctx: ResolverContext,
) => ResolverResult;

const resolvePropertyField: Resolver = (item, ctx) => {
  if (item.source.kind !== "property_field") return { status: "missing" };
  const path = item.source.path;

  if (path === "checkInWindow") {
    const start = ctx.property.checkInStart;
    const end = ctx.property.checkInEnd;
    if (nonEmpty(start) && nonEmpty(end)) {
      return {
        status: "resolved",
        value: `${start}–${end}`,
        sourceUsed: "canonical",
      };
    }
    if (nonEmpty(start)) {
      return { status: "resolved", value: start, sourceUsed: "canonical" };
    }
    return { status: "missing" };
  }

  if (!PROPERTY_FIELD_ALLOWLIST.has(path)) {
    return { status: "missing" };
  }
  const raw = (ctx.property as unknown as Record<string, unknown>)[path];
  if (raw === null || raw === undefined || raw === "") {
    return { status: "missing" };
  }
  return {
    status: "resolved",
    value: typeof raw === "string" ? raw : String(raw),
    sourceUsed: "canonical",
  };
};

const resolveContact: Resolver = (item, ctx) => {
  if (item.source.kind !== "contact") return { status: "missing" };
  const contact = pickContact(
    item.source.roleKey,
    item.source.fallbackRoleKeys,
    ctx,
  );
  if (!contact) return { status: "missing" };
  const raw = contact[item.source.field];
  if (!nonEmpty(raw)) return { status: "missing" };
  return { status: "resolved", value: raw, sourceUsed: "contact" };
};

const resolveKnowledgeItem: Resolver = (item, ctx) => {
  if (item.source.kind !== "knowledge_item") return { status: "missing" };
  const topic = item.source.topic;

  // 1. Canonical source first.
  const canonical = CANONICAL_RENDERERS[topic]?.(ctx);
  if (nonEmpty(canonical)) {
    return { status: "resolved", value: canonical, sourceUsed: "canonical" };
  }

  // 2. KI fallback — skipped for short-value variables (KI is narrative).
  if (SHORT_VALUE_VARIABLES.has(item.variable)) {
    return { status: "missing" };
  }
  const ki = pickKnowledgeItem(ctx.knowledgeByTopic.get(topic));
  if (ki && nonEmpty(ki.bodyMd)) {
    return {
      status: "resolved",
      value: ki.bodyMd,
      sourceUsed: "knowledge_item",
    };
  }

  return { status: "missing" };
};

const resolveDerived: Resolver = (item, ctx) => {
  if (item.source.kind !== "derived") return { status: "missing" };
  if (item.source.derivation === "guide_url") {
    if (!nonEmpty(ctx.property.publicSlug)) {
      return { status: "missing" };
    }
    const path = `/g/${ctx.property.publicSlug}`;
    const value = ctx.guideBaseUrl
      ? `${ctx.guideBaseUrl.replace(/\/$/, "")}${path}`
      : path;
    return { status: "resolved", value, sourceUsed: "derived" };
  }
  return { status: "missing" };
};

const RESERVATION_DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function getReservationDateFormatter(
  locale: string,
  timeZone: string,
): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone}`;
  const cached = RESERVATION_DATE_FORMATTERS.get(key);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone,
  });
  RESERVATION_DATE_FORMATTERS.set(key, fmt);
  return fmt;
}

function formatReservationDate(
  date: Date,
  locale: string,
  timeZone: string,
): string {
  return getReservationDateFormatter(locale, timeZone).format(date);
}

const RESERVATION_FIELD_READERS: Record<
  string,
  (r: ReservationContextRow, locale: string, timeZone: string) => string | null
> = {
  guestName: (r) => (nonEmpty(r.guestName) ? r.guestName : null),
  checkInDate: (r, locale, tz) => formatReservationDate(r.checkInDate, locale, tz),
  checkOutDate: (r, locale, tz) => formatReservationDate(r.checkOutDate, locale, tz),
  numGuests: (r) => String(r.numGuests),
};

const resolveReservation: Resolver = (item, ctx) => {
  if (item.source.kind !== "reservation") return { status: "missing" };
  if (!ctx.reservation) return { status: "unresolved_context" };
  const reader = RESERVATION_FIELD_READERS[item.source.field];
  if (!reader) return { status: "missing" };
  const locale = ctx.reservation.locale ?? ctx.property.defaultLocale;
  // `checkInDate`/`checkOutDate` are @db.Date (UTC midnight). Format in the
  // property's timezone so a reservation on 2026-05-10 renders as "10 de mayo"
  // even for properties east/west of UTC.
  const timeZone = ctx.property.timezone ?? "UTC";
  const raw = reader(ctx.reservation, locale, timeZone);
  if (!nonEmpty(raw)) return { status: "missing" };
  return { status: "resolved", value: raw, sourceUsed: "canonical" };
};

export const RESOLVERS: Record<MessagingVariableSourceKind, Resolver> = {
  property_field: resolvePropertyField,
  contact: resolveContact,
  knowledge_item: resolveKnowledgeItem,
  derived: resolveDerived,
  reservation: resolveReservation,
};

export function resolveVariableItem(
  item: MessagingVariableItem,
  ctx: ResolverContext,
): ResolverResult {
  return RESOLVERS[item.source.kind](item, ctx);
}
