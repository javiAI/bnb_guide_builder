// Single source of truth for visibility levels.
//
// Canonical enum: { guest, ai, internal, sensitive } — mirrors Prisma's
// VisibilityLevel. Order below is semantic: each level can see itself and
// anything above it in the list (guest is the broadest audience).

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
