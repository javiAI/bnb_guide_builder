import Link from "next/link";
import type { DerivationStatus } from "@/lib/amenity-derivation-resolver";

interface AmenityDerivedBadgeProps {
  label: string;
  description: string;
  status: DerivationStatus;
}

/**
 * Read-only pill for amenities whose state is derived from another module
 * (Sistemas / Espacios / Acceso). Shows active/inactive state + a deep-link
 * CTA to the section where the underlying concept is configured.
 */
export function AmenityDerivedBadge({
  label,
  description,
  status,
}: AmenityDerivedBadgeProps) {
  const dotClass = status.isActive
    ? "bg-[var(--color-success-500)]"
    : "bg-[var(--color-neutral-300)]";

  return (
    <span
      title={description}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-3 py-1.5 text-xs text-[var(--color-primary-700)]"
    >
      <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />
      <span className="font-medium">{label}</span>
      {status.sourceSummary && (
        <span className="text-[var(--color-neutral-600)]">
          · {status.sourceSummary}
        </span>
      )}
      <Link
        href={status.sourceUrl}
        className="text-[var(--color-primary-600)] underline-offset-2 hover:underline"
      >
        Configurar en {status.sourceLabel} →
      </Link>
    </span>
  );
}
