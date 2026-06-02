import Link from "next/link";
import { Home, Sparkles, Phone, AlertCircle, type LucideIcon } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";

interface Kpi {
  label: string;
  value: number;
  hint?: string;
  href: string;
  icon: LucideIcon;
  tone?: "neutral" | "warn";
}

interface KpiStripProps {
  propertyId: string;
  spacesCount: number;
  amenityCount: number;
  contactsCount: number;
  blockersCount: number;
}

export function KpiStrip({
  propertyId,
  spacesCount,
  amenityCount,
  contactsCount,
  blockersCount,
}: KpiStripProps) {
  const kpis: Kpi[] = [
    {
      label: "Espacios",
      value: spacesCount,
      hint: spacesCount === 0 ? "Sin configurar" : "Configurados",
      href: `/properties/${propertyId}/spaces`,
      icon: Home,
    },
    {
      label: "Equipamiento",
      value: amenityCount,
      hint: amenityCount === 0 ? "Sin equipamiento" : "Items en la guía",
      href: `/properties/${propertyId}/amenities`,
      icon: Sparkles,
    },
    {
      label: "Contactos",
      value: contactsCount,
      hint: contactsCount === 0 ? "Sin contactos" : "Operativos",
      href: `/properties/${propertyId}/contacts`,
      icon: Phone,
    },
    {
      label: "Bloqueantes",
      value: blockersCount,
      hint: blockersCount === 0 ? "Sin bloqueantes" : "Pendientes",
      href: `/properties/${propertyId}/publishing`,
      icon: AlertCircle,
      tone: blockersCount > 0 ? "warn" : "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] sm:grid-cols-4">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon;
        const isWarn = kpi.tone === "warn";
        return (
          <Link
            key={kpi.label}
            href={kpi.href}
            className={`group relative flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-border-focus)] ${
              i < kpis.length - 1
                ? "border-b border-[var(--color-border-subtle)] sm:border-b-0 sm:border-r"
                : ""
            } ${i === 0 || i === 1 ? "border-b sm:border-b-0" : ""}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                {kpi.label}
              </span>
              <IconBadge icon={Icon} tone={isWarn ? "warning" : "neutral"} />
            </span>
            <span
              className={`text-[24px] font-semibold tabular-nums leading-none tracking-[-0.01em] ${
                isWarn
                  ? "text-[var(--color-status-warning-text)]"
                  : "text-[var(--color-text-primary)]"
              }`}
            >
              {kpi.value}
            </span>
            {kpi.hint && (
              <span
                className={`text-[12px] ${
                  isWarn
                    ? "text-[var(--color-status-warning-text)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                {kpi.hint}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
