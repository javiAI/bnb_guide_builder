// Escalation contact resolver.
//
// Given an intent (from `escalation-intent.ts`), pick the contact rows
// from the DB that should handle the handoff, applying:
//   • the intent's declared `contactRoles` first
//   • `fallbackToHost` (ct.host + ct.cohost) if the intent is empty
//   • the taxonomy-level fallback intent if still empty
//   • audience-gated visibility (sensitive never leaks, and a guest
//     audience only sees guest-visibility contacts)
//
// Tiebreak among candidates in a matched set:
//   emergencyAvailable desc → isPrimary desc → sortOrder asc → createdAt asc
//
// This service is consumed by the pipeline when `ask()` escalates; the
// resulting handoff envelope is persisted alongside citations in
// AssistantMessage.citationsJson (no migration needed).

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

export type EscalationFallbackLevel = "intent" | "intent_with_host" | "fallback";

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
  // Unknown intent id → degrade to the taxonomy-declared fallback. This is
  // defense-in-depth: the pipeline should never pass an id that's not in
  // the registry, but we don't want the handoff to blow up if it does.
  const effectiveIntent: EscalationIntent =
    intent ?? (findEscalationIntent(fallback.intentId) as EscalationIntent);

  const fetchContacts = (roles: string[]) =>
    loadContactsForRoles({
      propertyId: input.propertyId,
      roleKeys: roles,
      audience: input.audience,
    });

  // 1. Intent's own roles.
  let contacts = await fetchContacts(effectiveIntent.contactRoles);
  let fallbackLevel: EscalationFallbackLevel = "intent";

  // 2. If the intent has `fallbackToHost` and yielded nothing, try host/cohost.
  if (contacts.length === 0 && effectiveIntent.fallbackToHost) {
    contacts = await fetchContacts(["ct.host", "ct.cohost"]);
    fallbackLevel = "intent_with_host";
  }

  // 3. Last-resort: the taxonomy-level fallback intent's roles.
  if (contacts.length === 0) {
    contacts = await fetchContacts(fallback.contactRoles);
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
  // Apply visibility filter in-memory. `sensitive` is clamped upstream
  // (`allowedVisibilitiesFor` in the retriever already caps the pipeline
  // audience at internal) but we re-check here so a direct caller can't
  // slip a sensitive-level contact to a guest.
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
    // Prefer the explicit whatsapp field; fall back to phone so operators
    // don't need to double-enter the same number.
    const v = row.whatsapp ?? row.phone ?? row.phoneSecondary;
    if (!v) return null;
    const href = buildWhatsAppHref(v);
    if (!href) return null;
    return { kind, rawValue: v, href };
  }
  // kind === "email"
  if (!row.email) return null;
  const href = buildMailtoHref(row.email);
  if (!href) return null;
  return { kind, rawValue: row.email, href };
}

function pickNotes(row: ContactRow, audience: VisibilityLevel): string | null {
  if (audience === "guest") return row.guestVisibleNotes ?? null;
  // ai / internal see the richer internalNotes, falling back to the
  // guest-visible copy if no internal note was authored.
  return row.internalNotes ?? row.guestVisibleNotes ?? null;
}

export const __internal = { buildChannels, pickNotes };
