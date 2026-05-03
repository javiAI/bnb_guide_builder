import Link from "next/link";
import { Activity } from "lucide-react";
import { formatRelativeEs } from "@/lib/format-relative-es";
import type { BadgeTone } from "@/lib/types";

export interface ActivityFeedItem {
  id: string;
  message: string;
  whenISO: string;
  tone?: BadgeTone;
}

interface ActivityFeedCardProps {
  propertyId: string;
  items: ActivityFeedItem[];
}

const TONE_DOT: Record<BadgeTone, string> = {
  neutral: "border-[var(--color-border-default)]",
  success: "border-[var(--color-status-success-solid)]",
  warning: "border-[var(--color-status-warning-solid)]",
  danger: "border-[var(--color-status-error-solid)]",
};

export function ActivityFeedCard({ propertyId, items }: ActivityFeedCardProps) {
  return (
    <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
          <Activity size={14} aria-hidden="true" />
          Actividad reciente
        </h3>
        <Link
          href={`/properties/${propertyId}/activity`}
          className="text-[11px] font-medium text-[var(--color-text-link)] hover:underline"
        >
          Ver todo
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          Sin actividad reciente.
        </p>
      ) : (
        <ol className="relative flex-1 pl-4 before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-px before:bg-[var(--color-border-default)] before:content-['']">
          {items.map((item) => {
            const tone = item.tone ?? "neutral";
            return (
              <li
                key={item.id}
                className="relative py-1.5 pl-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]"
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-[-13px] top-[10px] h-[8px] w-[8px] rounded-full border-2 bg-[var(--color-background-elevated)] ${TONE_DOT[tone]}`}
                />
                <span className="text-[var(--color-text-primary)]">{item.message}</span>
                <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">
                  {formatRelativeEs(item.whenISO)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
