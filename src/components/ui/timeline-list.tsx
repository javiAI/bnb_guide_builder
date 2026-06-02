import type { ReactNode } from "react";
import type { BadgeTone } from "@/lib/types";
import { TONE_DOT_BORDER } from "@/lib/tone";
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
    <ol
      className={cn(
        "relative flex-1 pl-4",
        // Spine centered at 7px (left-1.5=6px + w-0.5=2px → center 7px) so it
        // aligns exactly with the 8px dots (li left 16px + dot left -13px +
        // half 4px = center 7px). A 1px line can't share an integer center
        // with an 8px (even) dot, so the connector is 2px.
        "before:absolute before:left-1.5 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-[var(--color-border-default)] before:content-['']",
        className,
      )}
    >
      {items.map((item) => {
        const tone = item.tone ?? "neutral";
        return (
          <li
            key={item.id}
            className="relative py-1.5 pl-1 text-[13px] leading-relaxed text-[var(--color-text-primary)]"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-[-13px] top-[10px] h-[8px] w-[8px] rounded-full border-2 bg-[var(--color-background-elevated)]",
                TONE_DOT_BORDER[tone],
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
