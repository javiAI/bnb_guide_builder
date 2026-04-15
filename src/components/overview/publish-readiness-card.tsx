import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ValidationFinding } from "@/lib/validations/cross-validations";

interface PublishReadinessCardProps {
  propertyId: string;
  overall: number;
  usable: boolean;
  publishable: boolean;
  blockers: ValidationFinding[];
  errors: ValidationFinding[];
}

/**
 * Headline readiness card: binary usable/publishable gates + the blocker list
 * that gates publishing. Errors (visibility leaks etc.) are grouped alongside
 * blockers because both must be zero before the property is publishable.
 */
export function PublishReadinessCard({
  propertyId,
  overall,
  usable,
  publishable,
  blockers,
  errors,
}: PublishReadinessCardProps) {
  const issues = [...blockers, ...errors];

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Listo para publicar
        </h3>
        <span className="text-2xl font-semibold tabular-nums text-[var(--foreground)]">
          {overall}%
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <Badge
          label={usable ? "Usable" : "No usable"}
          tone={usable ? "success" : "warning"}
        />
        <Badge
          label={publishable ? "Publicable" : "No publicable"}
          tone={publishable ? "success" : "danger"}
        />
      </div>
      {issues.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {issues.map((f) => (
            <li
              key={f.id}
              className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2"
            >
              <span className="text-xs text-[var(--foreground)]">{f.message}</span>
              {f.ctaUrl && (
                <Link
                  href={f.ctaUrl}
                  className="shrink-0 text-xs font-medium text-[var(--color-primary-600)] hover:underline"
                >
                  {f.ctaLabel ?? "Ir"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-[var(--color-neutral-500)]">
          Sin bloqueantes. Revisa la página de publicación para ver los outputs
          disponibles.
        </p>
      )}
      <div className="mt-4">
        <Link
          href={`/properties/${propertyId}/publishing`}
          className="text-xs font-medium text-[var(--color-primary-600)] hover:underline"
        >
          Ir a publicación →
        </Link>
      </div>
    </div>
  );
}
