import troubleshootingJson from "../../taxonomies/troubleshooting_taxonomy.json";

export type SeverityTone = "neutral" | "warning" | "danger";

// Severity scale lives in the taxonomy (severity_levels) — this module only
// projects it into the badge shape consumers already use. Zero hardcoded
// domain lists (carta 16I).
const levels = (
  troubleshootingJson as unknown as {
    severity_levels: { id: string; label: string; tone: SeverityTone }[];
  }
).severity_levels;

export const SEVERITY_BADGE: Record<string, { label: string; tone: SeverityTone }> =
  Object.fromEntries(levels.map((l) => [l.id, { label: l.label, tone: l.tone }]));

/** Ordered severity ids (low → critical) for pickers. */
export const SEVERITY_LEVELS = levels.map((l) => l.id);
