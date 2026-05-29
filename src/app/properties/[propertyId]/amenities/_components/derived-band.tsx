import { cn } from "@/lib/cn";
import { TextLink } from "@/components/ui/text-link";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import type { DerivedAmenityItem } from "../page";

interface DerivedBandProps {
  items: DerivedAmenityItem[];
}

/**
 * Read-only band for amenities whose state is derived from another module
 * (Sistemas / Espacios / Acceso). No checkbox — each row shows the derived
 * state (active/inactive dot) and a deep link to the module that owns it (F1).
 */
export function DerivedBand({ items }: DerivedBandProps) {
  if (items.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-[var(--color-border-default)] py-2.5 pl-3">
        <SectionEyebrow>Derivado de otros módulos</SectionEyebrow>
        <span className="text-[11.5px] text-[var(--color-text-muted)]">
          Se gestiona en Sistemas · Espacios · Acceso
        </span>
      </div>

      <div>
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] py-3 pl-3 last:border-b-0"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                item.status.isActive
                  ? "bg-[var(--color-status-success-solid)]"
                  : "bg-[var(--color-border-strong)]",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="text-[13.5px] font-medium text-[var(--color-text-primary)]">
                {item.label}
              </span>
              <span className="sr-only">
                {item.status.isActive ? " (activo)" : " (inactivo)"}
              </span>
              {item.status.sourceSummary && (
                <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--color-text-muted)]">
                  {item.status.sourceSummary}
                </span>
              )}
            </span>
            <TextLink
              href={item.status.sourceUrl}
              size="sm"
              arrow
              className="shrink-0"
            >
              Configurar en {item.status.sourceLabel}
            </TextLink>
          </div>
        ))}
      </div>
    </section>
  );
}
