import completenessRules from "../../taxonomies/completeness_rules.json";

interface SectionProgressProps {
  score: number;
}

/**
 * Tiny circular progress badge for sidebar nav items.
 *
 * Color thresholds come from completeness_rules.json:
 *   ≥ publishable → green, ≥ usable → amber, otherwise red.
 */
export function SectionProgress({ score }: SectionProgressProps) {
  const { usableMinScore, publishableMinScore } = completenessRules.thresholds;
  const tone =
    score >= publishableMinScore
      ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
      : score >= usableMinScore
        ? "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]"
        : "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]";
  return (
    <span
      className={`ml-auto inline-flex min-w-[2.25rem] justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}
      title={`Completitud: ${score}%`}
      aria-label={`Completitud: ${score}%`}
      role="status"
    >
      {score}%
    </span>
  );
}
