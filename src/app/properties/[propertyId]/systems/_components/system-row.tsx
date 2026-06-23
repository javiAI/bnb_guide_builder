import Link from "next/link";
import {
  ArrowRight,
  Camera,
  EyeOff,
  ListChecks,
  TriangleAlert,
  Video,
  type LucideIcon,
} from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
import { EntityCardStatusPill } from "@/components/ui/entity-media-card";
import { SYSTEM_STATUS_KEY, SYSTEM_STATUS_LABEL, type SystemStatus } from "./system-status";

export interface SystemRowData {
  href: string;
  icon: LucideIcon;
  title: string;
  description?: string | null;
  groupLabel: string;
  status: SystemStatus;
  /** Hover explanation of what's still missing (only when partial / empty). */
  statusDetail?: string;
  fieldsFilled: number;
  fieldsTotal: number;
  photos: number;
  videos: number;
  openIncidents: number;
  internal: boolean;
}

function Meta({
  icon: Icon,
  children,
  warn = false,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        warn ? "text-[var(--color-status-warning-text)]" : "text-[var(--color-text-muted)]"
      }`}
    >
      <Icon size={13} aria-hidden="true" className="shrink-0" />
      {children}
    </span>
  );
}

export function SystemRow({
  href,
  icon,
  title,
  description,
  groupLabel,
  status,
  statusDetail,
  fieldsFilled,
  fieldsTotal,
  photos,
  videos,
  openIncidents,
  internal,
}: SystemRowData) {
  return (
    <Link
      href={href}
      className="group flex min-h-[44px] items-start gap-3.5 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4 text-[var(--color-text-primary)] no-underline transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
    >
      <IconBadge icon={icon} tone="neutral" size="md" iconSize={17} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[14px] font-semibold leading-snug text-[var(--color-text-primary)]">
            {title}
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--color-background-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
            {groupLabel}
          </span>
          {internal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-background-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
              <EyeOff size={11} aria-hidden="true" />
              Solo interno
            </span>
          )}
        </div>

        {description && (
          <p className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          {fieldsTotal > 0 && (
            <Meta icon={ListChecks}>
              <span>
                <b className="font-semibold text-[var(--color-text-secondary)]">
                  {fieldsFilled}
                </b>
                /{fieldsTotal} campos
              </span>
            </Meta>
          )}
          <Meta icon={Camera}>
            {photos > 0 ? (
              <span>
                <b className="font-semibold text-[var(--color-text-secondary)]">{photos}</b>{" "}
                {photos === 1 ? "foto" : "fotos"}
              </span>
            ) : (
              <span>Sin fotos</span>
            )}
          </Meta>
          {videos > 0 && (
            <Meta icon={Video}>
              <span>
                <b className="font-semibold text-[var(--color-text-secondary)]">{videos}</b>{" "}
                {videos === 1 ? "vídeo" : "vídeos"}
              </span>
            </Meta>
          )}
          {openIncidents > 0 && (
            <Meta icon={TriangleAlert} warn>
              <span>
                <b className="font-semibold">{openIncidents}</b>{" "}
                {openIncidents === 1 ? "incidencia abierta" : "incidencias abiertas"}
              </span>
            </Meta>
          )}
        </div>
      </div>

      <div className="flex shrink-0 self-center">
        <EntityCardStatusPill
          status={SYSTEM_STATUS_KEY[status]}
          label={SYSTEM_STATUS_LABEL[status]}
          detail={statusDetail}
        />
      </div>

      <ArrowRight
        size={16}
        aria-hidden="true"
        className="mt-1 shrink-0 self-center text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-text-primary)]"
      />
    </Link>
  );
}
