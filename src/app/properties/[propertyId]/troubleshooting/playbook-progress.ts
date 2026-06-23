/**
 * Honest, transparent completeness for a playbook ("solución") card — mirror of
 * `space-progress.ts`. Two guest-meaningful signals:
 *
 *   - guest steps (`guestStepsMd`) — the content that actually publishes to the
 *     guest guide and feeds the assistant;
 *   - a severity — drives triage and the badge shown everywhere.
 *
 * `complete` = both present. `empty` is honest: only a card with no written
 * content at all (a freshly one-click-created playbook — severity comes
 * defaulted from the taxonomy, so it doesn't count as "content"). Everything
 * else is `partial`. Pure (no React) so it runs identically on the server
 * aggregate ("X de Y listas" header chip) and the live client card.
 */

export type PlaybookProgressLevel = "empty" | "partial" | "complete";

export interface PlaybookContent {
  severity: string;
  symptomsMd: string;
  guestStepsMd: string;
  internalStepsMd: string;
  escalationRule: string;
}

function hasGuestSteps(c: PlaybookContent): boolean {
  return c.guestStepsMd.trim() !== "";
}

function hasSeverity(c: PlaybookContent): boolean {
  return c.severity.trim() !== "";
}

export function computePlaybookStatus(c: PlaybookContent): PlaybookProgressLevel {
  if (hasGuestSteps(c) && hasSeverity(c)) return "complete";
  const anyContent =
    hasGuestSteps(c) ||
    c.symptomsMd.trim() !== "" ||
    c.internalStepsMd.trim() !== "" ||
    c.escalationRule.trim() !== "";
  return anyContent ? "partial" : "empty";
}

/**
 * The unmet signals behind a non-complete status, as operator-facing labels —
 * surfaced on the status pill's hover so "En progreso" explains itself.
 * Mirrors computePlaybookStatus exactly: same signals, same applicability.
 */
export function missingPlaybookSignals(c: PlaybookContent): string[] {
  const missing: string[] = [];
  if (!hasGuestSteps(c)) missing.push("los pasos para el huésped");
  if (!hasSeverity(c)) missing.push("la severidad");
  return missing;
}
