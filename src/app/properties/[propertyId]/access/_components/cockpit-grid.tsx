"use client";

import { type ReactNode } from "react";

export type CardRole = "idle" | "active";

interface CockpitGridProps {
  expandedId: string | null;
  ids: readonly string[];
  children: (id: string, role: CardRole) => ReactNode;
}

// Column policy: only {1, 2} are allowed.
//
// Breakpoints:
//   < md   (<768)   → 1 col (1×4 stack)
//   ≥ md   (≥768)   → 2 cols (2×2 grid)
//
// 4-col layout is intentionally NOT supported here. The access page wraps
// CockpitGrid in `max-w-5xl px-6` (1024 - 48 = 976 effective content). With
// 4 cols + gap-3 (3 gaps × 12 = 36), each card is (976-36)/4 = 235px wide.
// content-box = 235 - 40 (p-5) - 3 (border 1.5×2) = 192. Title area =
// 192 - 40 (icon) - 12 (gap) - 12 (pr-3) = 128px — too narrow for the
// longest taxonomy titles "Aparcamiento" (~140px) / "Accesibilidad" (~150px).
// Result on wide viewports was the title truncating to "Aparcamien…".
// Falling back to 2×2 above md gives cards (976-12)/2 = 482px wide — title
// has ~370px of room, fits trivially. If a future redesign widens the page
// container, 4-col can be re-evaluated here against the new content width.
export function CockpitGrid({ expandedId, ids, children }: CockpitGridProps) {
  const expanded = expandedId !== null;
  return (
    <div
      className={
        expanded
          ? "grid gap-3 grid-cols-1"
          : "grid gap-3 grid-cols-1 md:grid-cols-2"
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
