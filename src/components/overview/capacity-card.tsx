import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface CapacityCardProps {
  propertyId: string;
  maxGuests: number | null;
  sleepingCapacity: number;
}

/**
 * Compares declared `maxGuests` against computed `sleepingCapacity` (from beds)
 * and surfaces the mismatch as a single actionable card. Both "no aforo" and
 * "no beds" are soft states — they don't block, but the user should resolve
 * them. A mismatch (maxGuests > sleeping) is a warning per `validateCapacityCoherence`.
 */
export function CapacityCard({
  propertyId,
  maxGuests,
  sleepingCapacity,
}: CapacityCardProps) {
  const hasGuests = maxGuests != null;
  const hasBeds = sleepingCapacity > 0;
  const mismatch = hasGuests && hasBeds && maxGuests > sleepingCapacity;

  const tone = !hasGuests || !hasBeds || mismatch ? "warning" : "success";
  const label =
    !hasGuests
      ? "Aforo no configurado"
      : !hasBeds
        ? "Sin camas"
        : mismatch
          ? "Revisar"
          : "Coherente";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Capacidad</h3>
        <Badge label={label} tone={tone} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Aforo máximo</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">
            {hasGuests ? maxGuests : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Capacidad en camas</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">
            {hasBeds ? sleepingCapacity : "—"}
          </p>
        </div>
      </div>
      {mismatch && (
        <p className="mt-3 text-xs text-[var(--color-status-warning-text)]">
          El aforo supera la capacidad de camas. Revisa la configuración o reduce el
          máximo de huéspedes.
        </p>
      )}
      <div className="mt-3 flex gap-3 text-xs font-medium">
        <Link
          href={`/properties/${propertyId}/property`}
          className="text-[var(--color-text-link)] hover:underline"
        >
          Editar aforo
        </Link>
        <Link
          href={`/properties/${propertyId}/spaces`}
          className="text-[var(--color-text-link)] hover:underline"
        >
          Revisar camas
        </Link>
      </div>
    </div>
  );
}
