export type SeverityTone = "neutral" | "warning" | "danger";

export const SEVERITY_BADGE: Record<string, { label: string; tone: SeverityTone }> = {
  low: { label: "Baja", tone: "neutral" },
  medium: { label: "Media", tone: "warning" },
  high: { label: "Alta", tone: "danger" },
  critical: { label: "Crítica", tone: "danger" },
};
