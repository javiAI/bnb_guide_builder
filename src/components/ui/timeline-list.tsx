import type { ReactNode } from "react";
import type { BadgeTone } from "@/lib/types";
import { TONE_DOT_FILL } from "@/lib/tone";
import { cn } from "@/lib/cn";

/* `content` renders directly inside <li> — block or inline both valid per HTML
 * spec. `meta` and `emptyText` render inside fixed <span>/<p> wrappers, so they
 * must be phrasing content only — narrowed to string|number to make the
 * constraint type-enforced rather than documented. */
export interface TimelineListItem {
  id: string;
  tone?: BadgeTone;
  content: ReactNode;
  meta?: string | number;
}

interface TimelineListProps {
  items: TimelineListItem[];
  emptyText?: string | number;
  className?: string;
}

export function TimelineList({ items, emptyText, className }: TimelineListProps) {
  if (items.length === 0) {
    if (emptyText === undefined) return null;
    return (
      <p className={cn("text-[13px] leading-relaxed text-[var(--color-text-secondary)]", className)}>
        {emptyText}
      </p>
    );
  }

  return (
    <ol className={cn("flex flex-1 flex-col", className)}>
      {items.map((item, idx) => {
        const tone = item.tone ?? "neutral";
        // Connector segments are drawn per-item and bounded: the first item has
        // no segment above its dot, the last none below — so the spine spans
        // exactly first-dot → last-dot and never overshoots. The dot's elevated
        // ring masks the line crossing behind it. Dot center sits at 10px
        // (top-[6px] + half of h-2), aligned with the first text line.
        const showAbove = idx > 0;
        const showBelow = idx < items.length - 1;
        return (
          <li
            key={item.id}
            className="relative pb-3 pl-5 text-[13px] leading-relaxed text-[var(--color-text-primary)] last:pb-0"
          >
            {showAbove && (
              <span
                aria-hidden="true"
                className="absolute left-[4px] top-0 h-[10px] w-px -translate-x-1/2 bg-[var(--color-border-default)]"
              />
            )}
            {showBelow && (
              <span
                aria-hidden="true"
                className="absolute left-[4px] top-[10px] bottom-0 w-px -translate-x-1/2 bg-[var(--color-border-default)]"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-[4px] top-[6px] h-2 w-2 -translate-x-1/2 rounded-full ring-4 ring-[var(--color-background-elevated)]",
                TONE_DOT_FILL[tone],
              )}
            />
            {item.content}
            {item.meta !== undefined && (
              <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">{item.meta}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
