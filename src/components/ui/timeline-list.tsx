import type { ReactNode } from "react";
import type { BadgeTone } from "@/lib/types";
import { TONE_DOT_BORDER } from "@/lib/tone";
import { cn } from "@/lib/cn";

export interface TimelineListItem {
  id: string;
  tone?: BadgeTone;
  content: ReactNode;
  meta?: ReactNode;
}

interface TimelineListProps {
  items: TimelineListItem[];
  emptyText?: ReactNode;
  className?: string;
}

export function TimelineList({ items, emptyText, className }: TimelineListProps) {
  if (items.length === 0) {
    if (!emptyText) return null;
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
        "before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-px before:bg-[var(--color-border-default)] before:content-['']",
        className,
      )}
    >
      {items.map((item) => {
        const tone = item.tone ?? "neutral";
        return (
          <li
            key={item.id}
            className="relative py-1.5 pl-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-[-13px] top-[10px] h-[8px] w-[8px] rounded-full border-2 bg-[var(--color-background-elevated)]",
                TONE_DOT_BORDER[tone],
              )}
            />
            <span className="text-[var(--color-text-primary)]">{item.content}</span>
            {item.meta && (
              <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">{item.meta}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
