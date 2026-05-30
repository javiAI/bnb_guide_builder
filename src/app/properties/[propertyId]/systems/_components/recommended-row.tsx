import type { LucideIcon } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
import { AddSystemButton } from "./add-system-button";

export interface RecommendedRowData {
  propertyId: string;
  systemKey: string;
  icon: LucideIcon;
  title: string;
  description?: string | null;
  groupLabel: string;
}

/**
 * "Por configurar" row (§03): a recommended system not yet installed. Dashed,
 * muted card with a per-row quick-add affordance (Q6). Not a Link — there is no
 * detail page until the system exists; the only interactive element is the
 * AddSystemButton.
 */
export function RecommendedRow({
  propertyId,
  systemKey,
  icon,
  title,
  description,
  groupLabel,
}: RecommendedRowData) {
  return (
    <div className="flex items-start gap-3.5 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-default)] bg-[var(--color-background-subtle)] p-4">
      <IconBadge icon={icon} tone="neutral" size="md" iconSize={17} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[14px] font-semibold leading-snug text-[var(--color-text-primary)]">
            {title}
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--color-background-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
            {groupLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--color-action-primary-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-action-primary-subtle-fg)]">
            Recomendado
          </span>
        </div>
        {description && (
          <p className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>

      <div className="shrink-0">
        <AddSystemButton propertyId={propertyId} systemKey={systemKey} label={title} />
      </div>
    </div>
  );
}
