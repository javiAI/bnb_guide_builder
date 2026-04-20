import { prisma } from "@/lib/db";
import {
  findEscalationIntent,
  getEscalationFallback,
  type EscalationChannel,
  type EscalationIntent,
  type EscalationIntentId,
} from "@/lib/taxonomy-loader";
import {
  buildMailtoHref,
  buildTelHref,
  buildWhatsAppHref,
} from "@/lib/contact-actions";
import { canAudienceSee, normaliseVisibility, type VisibilityLevel } from "@/lib/visibility";

// ============================================================================
// Contract
// ============================================================================

export interface ResolveEscalationInput {
  propertyId: string;
  intentId: EscalationIntentId;
  audience: VisibilityLevel;
}

export interface ResolvedContactChannel {
  kind: EscalationChannel;
  rawValue: string;
  href: string;
}

export interface ResolvedContact {
  id: string;
  roleKey: string;
  displayName: string;
  channels: ResolvedContactChannel[];
  emergencyAvailable: boolean;
  isPrimary: boolean;
  /** Notes the audience is allowed to see; `guest` → `guestVisibleNotes`,
   *  internal/ai → `internalNotes ?? guestVisibleNotes`. `null` otherwise. */
  notes: string | null;
}

export const FALLBACK_LEVELS = ["intent", "intent_with_host", "fallback"] as const;
export type EscalationFallbackLevel = (typeof FALLBACK_LEVELS)[number];

const HOST_ROLES = ["ct.host", "ct.cohost"] as const;

export interface EscalationResolution {
  intentId: EscalationIntentId;
  intentLabel: string;
  emergencyPriority: boolean;
  fallbackLevel: EscalationFallbackLevel;
  contacts: ResolvedContact[];
}

// ============================================================================
// Public API
// ============================================================================

export async function resolveEscalation(
  input: ResolveEscalationInput,
): Promise<EscalationResolution | null> {
  const intent = findEscalationIntent(input.intentId) ?? null;
  const fallback = getEscalationFallback();
  const effectiveIntent: EscalationIntent =
    intent ?? (findEscalationIntent(fallback.intentId) as EscalationIntent);

  const tier1 = new Set(effectiveIntent.contactRoles);
  const tier2 = effectiveIntent.fallbackToHost ? new Set<string>(HOST_ROLES) : null;
  const tier3 = new Set(fallback.contactRoles);
  const unionRoles = [...new Set([...tier1, ...(tier2 ?? []), ...tier3])];

  const visibleRows = await loadContactsForRoles({
    propertyId: input.propertyId,
    roleKeys: unionRoles,
    audience: input.audience,
  });

  const pickTier = (roles: Set<string>) =>
    visibleRows.filter((r) => roles.has(r.roleKey));

  let contacts = pickTier(tier1);
  let fallbackLevel: EscalationFallbackLevel = "intent";
  if (contacts.length === 0 && tier2) {
    contacts = pickTier(tier2);
    fallbackLevel = "intent_with_host";
  }
  if (contacts.length === 0) {
    contacts = pickTier(tier3);
    fallbackLevel = "fallback";
  }
  if (contacts.length === 0) return null;

  const channelPriority = effectiveIntent.channelPriority;
  return {
    intentId: effectiveIntent.id,
    intentLabel: effectiveIntent.label,
    emergencyPriority: effectiveIntent.emergencyPriority,
    fallbackLevel,
    contacts: contacts.map((c) => projectContact(c, channelPriority, input.audience)),
  };
}

// ============================================================================
// Internals
// ============================================================================

interface ContactRow {
  id: string;
  roleKey: string;
  displayName: string;
  phone: string | null;
  phoneSecondary: string | null;
  email: string | null;
  whatsapp: string | null;
  emergencyAvailable: boolean;
  isPrimary: boolean;
  sortOrder: number;
  visibility: string;
  internalNotes: string | null;
  guestVisibleNotes: string | null;
  createdAt: Date;
}

async function loadContactsForRoles(params: {
  propertyId: string;
  roleKeys: string[];
  audience: VisibilityLevel;
}): Promise<ContactRow[]> {
  if (params.roleKeys.length === 0) return [];
  const rows = await prisma.contact.findMany({
    where: {
      propertyId: params.propertyId,
      roleKey: { in: params.roleKeys },
    },
    orderBy: [
      { emergencyAvailable: "desc" },
      { isPrimary: "desc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      roleKey: true,
      displayName: true,
      phone: true,
      phoneSecondary: true,
      email: true,
      whatsapp: true,
      emergencyAvailable: true,
      isPrimary: true,
      sortOrder: true,
      visibility: true,
      internalNotes: true,
      guestVisibleNotes: true,
      createdAt: true,
    },
  });
  // Defense-in-depth: a caller that bypasses the retriever must not reach
  // sensitive-visibility contacts.
  return rows.filter((r) =>
    canAudienceSee(params.audience, normaliseVisibility(r.visibility)),
  );
}

function projectContact(
  row: ContactRow,
  channelPriority: ReadonlyArray<EscalationChannel>,
  audience: VisibilityLevel,
): ResolvedContact {
  return {
    id: row.id,
    roleKey: row.roleKey,
    displayName: row.displayName,
    channels: buildChannels(row, channelPriority),
    emergencyAvailable: row.emergencyAvailable,
    isPrimary: row.isPrimary,
    notes: pickNotes(row, audience),
  };
}

function buildChannels(
  row: ContactRow,
  priority: ReadonlyArray<EscalationChannel>,
): ResolvedContactChannel[] {
  const out: ResolvedContactChannel[] = [];
  for (const kind of priority) {
    const ch = buildChannel(kind, row);
    if (ch) out.push(ch);
  }
  return out;
}

function buildChannel(
  kind: EscalationChannel,
  row: ContactRow,
): ResolvedContactChannel | null {
  if (kind === "tel") {
    const v = row.phone ?? row.phoneSecondary;
    if (!v) return null;
    return { kind, rawValue: v, href: buildTelHref(v) };
  }
  if (kind === "whatsapp") {
    const v = row.whatsapp ?? row.phone ?? row.phoneSecondary;
    if (!v) return null;
    const href = buildWhatsAppHref(v);
    if (!href) return null;
    return { kind, rawValue: v, href };
  }
  if (!row.email) return null;
  const href = buildMailtoHref(row.email);
  if (!href) return null;
  return { kind, rawValue: row.email, href };
}

function pickNotes(row: ContactRow, audience: VisibilityLevel): string | null {
  if (audience === "guest") return row.guestVisibleNotes ?? null;
  return row.internalNotes ?? row.guestVisibleNotes ?? null;
}

export const __internal = { buildChannels, pickNotes };
