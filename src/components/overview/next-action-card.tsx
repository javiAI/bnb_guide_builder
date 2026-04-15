import Link from "next/link";
import type { SectionScores } from "@/lib/services/completeness.service";
import type { ValidationFinding } from "@/lib/validations/cross-validations";
import { SECTION_META_BY_KEY } from "./section-map";

interface NextActionCardProps {
  propertyId: string;
  scores: SectionScores;
  blockers: ValidationFinding[];
  errors: ValidationFinding[];
}

interface NextAction {
  title: string;
  description: string;
  ctaUrl: string;
  ctaLabel: string;
}

/**
 * Picks the single most impactful next action. Blockers/errors come first
 * (they gate publishing); otherwise the lowest-scoring section drives the CTA.
 * When nothing matters, returns a "celebrate" message instead of a CTA.
 */
function pickNextAction(
  propertyId: string,
  scores: SectionScores,
  blockers: ValidationFinding[],
  errors: ValidationFinding[],
): NextAction | null {
  const topIssue = blockers[0] ?? errors[0];
  if (topIssue) {
    return {
      title: "Resuelve un bloqueante",
      description: topIssue.message,
      ctaUrl: topIssue.ctaUrl ?? `/properties/${propertyId}/publishing`,
      ctaLabel: topIssue.ctaLabel ?? "Ir",
    };
  }

  const keys = Object.keys(scores) as (keyof SectionScores)[];
  const lowest = keys.reduce((a, b) => (scores[a] <= scores[b] ? a : b));
  if (scores[lowest] >= 85) return null;

  const meta = SECTION_META_BY_KEY[lowest];
  return {
    title: `Mejora ${meta.label}`,
    description: `Score actual: ${scores[lowest]}%. Completa los campos pendientes para desbloquear outputs.`,
    ctaUrl: `/properties/${propertyId}/${meta.href}`,
    ctaLabel: `Ir a ${meta.label.toLowerCase()}`,
  };
}

export function NextActionCard({
  propertyId,
  scores,
  blockers,
  errors,
}: NextActionCardProps) {
  const action = pickNextAction(propertyId, scores, blockers, errors);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--color-primary-50)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-700)]">
        Siguiente paso
      </h3>
      {action ? (
        <>
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            {action.title}
          </p>
          <p className="mt-1 text-xs text-[var(--color-neutral-600)]">
            {action.description}
          </p>
          <Link
            href={action.ctaUrl}
            className="mt-3 inline-flex items-center text-xs font-semibold text-[var(--color-primary-700)] hover:underline"
          >
            {action.ctaLabel} →
          </Link>
        </>
      ) : (
        <p className="mt-2 text-sm text-[var(--foreground)]">
          Todo listo. No hay acciones pendientes.
        </p>
      )}
    </div>
  );
}
