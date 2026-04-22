// Single source of truth for visibility levels.
//
// Canonical enum: { guest, ai, internal, sensitive } — mirrors Prisma's
// VisibilityLevel. Order below is semantic: each audience can see content
// at its own level or below in the list (that is, less restricted content;
// guest is the broadest audience, sensitive the narrowest).

export const visibilityLevels = ["guest", "ai", "internal", "sensitive"] as const;

export type VisibilityLevel = (typeof visibilityLevels)[number];

export const VISIBILITY_ORDER: Record<VisibilityLevel, number> = {
  guest: 0,
  ai: 1,
  internal: 2,
  sensitive: 3,
};

export const VISIBILITY_LABEL: Record<VisibilityLevel, string> = {
  guest: "Huésped",
  ai: "AI",
  internal: "Interno",
  sensitive: "Sensible",
};

export const VISIBILITY_TONE: Record<
  VisibilityLevel,
  "success" | "neutral" | "warning" | "danger"
> = {
  guest: "success",
  ai: "neutral",
  internal: "warning",
  sensitive: "danger",
};

// Legacy string values that may appear in old code paths or tests.
// Kept as a one-way normaliser; writing paths should only ever persist
// canonical values.
const LEGACY_MAP: Record<string, VisibilityLevel> = {
  public: "guest",
  booked_guest: "guest",
  secret: "sensitive",
};

export function normaliseVisibility(value: string | null | undefined): VisibilityLevel {
  if (!value) return "guest";
  if ((visibilityLevels as readonly string[]).includes(value)) return value as VisibilityLevel;
  return LEGACY_MAP[value] ?? "internal";
}

export function canAudienceSee(
  audience: VisibilityLevel,
  itemLevel: VisibilityLevel,
): boolean {
  // An audience sees everything at its level OR below. Sensitive items are
  // never exposed beyond their own audience.
  return VISIBILITY_ORDER[itemLevel] <= VISIBILITY_ORDER[audience];
}

export const AUDIENCE_LABELS: Record<VisibilityLevel, string> = {
  guest: "huéspedes durante la estancia",
  ai: "uso interno de IA",
  internal: "uso interno",
  sensitive: "uso interno restringido",
};

export const AUDIENCE_LABELS_EN: Record<VisibilityLevel, string> = {
  guest: "guests during their stay",
  ai: "internal AI use",
  internal: "internal use",
  sensitive: "restricted internal use",
};

export const SENSITIVITY_LABELS: Record<VisibilityLevel, string> = {
  guest: "baja",
  ai: "media",
  internal: "alta",
  sensitive: "máxima",
};

export const SENSITIVITY_LABELS_EN: Record<VisibilityLevel, string> = {
  guest: "low",
  ai: "medium",
  internal: "high",
  sensitive: "maximum",
};

// ── Incident field-level visibility (Rama 13D) ──
//
// A guest who reports an issue through the public guide can check its status
// via a slug-scoped, cookie-authenticated read path. The fields they may see
// are a fixed whitelist — adding a column to `Incident` never exposes it to
// the guest automatically.
//
// Rationale for whitelist vs blacklist: Incident carries free-form `notes`
// written by operators, `playbookId`, severity escalations, and future
// operational fields. Any blacklist forgetting to add a new sensitive field
// leaks it; a whitelist fails closed.
export const GUEST_INCIDENT_READABLE_FIELDS = [
  "id",
  "status",
  "categoryKey",
  "createdAt",
  "resolvedAt",
] as const;

export type GuestReadableIncidentField =
  (typeof GUEST_INCIDENT_READABLE_FIELDS)[number];

const GUEST_INCIDENT_READABLE_FIELD_SET: ReadonlySet<string> = new Set(
  GUEST_INCIDENT_READABLE_FIELDS,
);

/** True when `field` is in the fixed whitelist of Incident columns that a
 *  guest reporter may see about their own report. Consumers MUST use this to
 *  project before serializing any Incident to a guest-facing response — never
 *  filter by exclusion. */
export function guestCanReadIncidentField(field: string): boolean {
  return GUEST_INCIDENT_READABLE_FIELD_SET.has(field);
}
