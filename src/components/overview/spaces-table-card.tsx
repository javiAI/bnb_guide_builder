import Link from "next/link";
import { BedDouble, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/types";
import { formatRelativeEs } from "@/lib/format-relative-es";

export interface SpacesTableRow {
  id: string;
  name: string;
  spaceTypeLabel: string;
  amenityCount: number;
  photoCount: number;
  updatedAtISO: string;
  status: { label: string; tone: BadgeTone };
}

interface SpacesTableCardProps {
  propertyId: string;
  rows: SpacesTableRow[];
  totalCount: number;
}

export function SpacesTableCard({
  propertyId,
  rows,
  totalCount,
}: SpacesTableCardProps) {
  const visible = rows.slice(0, 6);
  const remaining = totalCount - visible.length;

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)]">
      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-3 p-5">
          <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            Aún no has añadido espacios.
          </p>
          <Link
            href={`/properties/${propertyId}/spaces`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 text-[13px] font-medium text-[var(--color-text-primary)] no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] hover:no-underline"
          >
            <Plus size={14} aria-hidden="true" />
            Añadir espacio
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                  <th className="px-5 py-3 font-semibold">Espacio</th>
                  <th className="px-3 py-3 font-semibold">Equipamiento</th>
                  <th className="px-3 py-3 font-semibold">Fotos</th>
                  <th className="px-3 py-3 font-semibold">Actualizado</th>
                  <th className="px-3 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-border-subtle)] last:border-b-0 transition-colors hover:bg-[var(--color-interactive-hover)]"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/properties/${propertyId}/spaces`}
                        className="flex items-center gap-2.5"
                      >
                        <span
                          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]"
                          aria-hidden="true"
                        >
                          <BedDouble size={14} />
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {row.name}
                          </span>
                          <span className="text-[12px] text-[var(--color-text-muted)]">
                            {row.spaceTypeLabel}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[var(--color-text-secondary)]">
                      {row.amenityCount} item{row.amenityCount === 1 ? "" : "s"}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[var(--color-text-secondary)]">
                      {row.photoCount} foto{row.photoCount === 1 ? "" : "s"}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[var(--color-text-secondary)]">
                      {formatRelativeEs(row.updatedAtISO)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge label={row.status.label} tone={row.status.tone} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ChevronRight
                        size={14}
                        aria-hidden="true"
                        className="text-[var(--color-text-muted)]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden">
            {visible.map((row) => (
              <li
                key={row.id}
                className="border-b border-[var(--color-border-subtle)] last:border-b-0"
              >
                <Link
                  href={`/properties/${propertyId}/spaces`}
                  className="flex min-h-[44px] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-interactive-hover)]"
                >
                  <span
                    className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]"
                    aria-hidden="true"
                  >
                    <BedDouble size={14} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                      {row.name}
                    </span>
                    <span className="truncate text-[12px] text-[var(--color-text-muted)]">
                      {row.spaceTypeLabel} · {row.amenityCount} items · {formatRelativeEs(row.updatedAtISO)}
                    </span>
                  </span>
                  <Badge label={row.status.label} tone={row.status.tone} />
                </Link>
              </li>
            ))}
          </ul>

          {remaining > 0 && (
            <div className="border-t border-[var(--color-border-subtle)] px-5 py-3 text-right">
              <Link
                href={`/properties/${propertyId}/spaces`}
                className="text-[12px] font-medium text-[var(--color-text-link)] hover:underline"
              >
                Ver los {remaining} restantes →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
