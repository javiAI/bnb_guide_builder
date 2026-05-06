"use client";

import { type ReactNode } from "react";

export type CardRole = "idle" | "active";

interface CockpitGridProps {
  expandedId: string | null;
  ids: readonly string[];
  children: (id: string, role: CardRole) => ReactNode;
}

// Column policy: only {1, 2, 4} are allowed — never 3 cards in a row with a
// stranded 4th below. With 4 subsystems this constraint forces the layout to
// look like one of {1×4 stack, 2×2 grid, 1×4 row}. The previous
// `auto-fit minmax(220px, 1fr)` produced a 3+1 layout in the 684–915px
// content-width band, which is the regression we're fixing.
//
// Breakpoints:
//   < sm   (<640)   → 1 col (1×4 stack)
//   sm     (≥640)   → 2 cols (2×2)
//   xl     (≥1280)  → 4 cols (1×4 row)
//
// xl (instead of lg) for the 4-col jump because the operator shell sidebar
// eats ~256px of viewport — at lg (1024) the available content is ~750px and
// 4 cards would shrink to ~180px each (cramped). At xl (1280), content is
// ~1024px and 4 cards land at ~250px each (comfortable).
export function CockpitGrid({ expandedId, ids, children }: CockpitGridProps) {
  const expanded = expandedId !== null;
  return (
    <div
      className={
        expanded
          ? "grid gap-3 grid-cols-1"
          : "grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      }
    >
      {ids.map((id) => {
        const isActive = expandedId === id;
        if (expanded && !isActive) return null;
        const role: CardRole = isActive ? "active" : "idle";
        return <div key={id}>{children(id, role)}</div>;
      })}
    </div>
  );
}
