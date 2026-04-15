import Link from "next/link";
import type { SectionScores } from "@/lib/services/completeness.service";
import { OVERVIEW_SECTIONS } from "./section-map";
import completenessRules from "../../../taxonomies/completeness_rules.json";

interface GapsCardProps {
  propertyId: string;
  scores: SectionScores;
}

function toneClass(score: number): string {
  const { usableMinScore, publishableMinScore } = completenessRules.thresholds;
  if (score >= publishableMinScore) return "bg-[var(--color-success-500)]";
  if (score >= usableMinScore) return "bg-[var(--color-warning-500)]";
  return "bg-[var(--color-danger-500)]";
}

/**
 * Four-row section readiness bar. Sorted ascending so the section that needs
 * the most attention sits at the top — makes the card act like a prioritised
 * task list rather than a static grid.
 */
export function GapsCard({ propertyId, scores }: GapsCardProps) {
  const sorted = [...OVERVIEW_SECTIONS].sort(
    (a, b) => scores[a.key] - scores[b.key],
  );

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        Gaps por sección
      </h3>
      <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
        Ordenado por urgencia. Haz clic para abrir la sección.
      </p>
      <ul className="mt-3 space-y-2">
        {sorted.map((row) => {
          const score = scores[row.key];
          return (
            <li key={row.key}>
              <Link
                href={`/properties/${propertyId}/${row.href}`}
                className="group flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 transition-colors hover:bg-[var(--color-neutral-50)]"
              >
                <span className="min-w-[7.5rem] text-sm text-[var(--foreground)] group-hover:underline">
                  {row.label}
                </span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                  <span
                    className={`absolute inset-y-0 left-0 ${toneClass(score)}`}
                    style={{ width: `${score}%` }}
                  />
                </span>
                <span className="min-w-[2.5rem] text-right text-xs font-semibold tabular-nums text-[var(--color-neutral-600)]">
                  {score}%
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
