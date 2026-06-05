"use client";

import { type ReactNode } from "react";
import type { EntityCardRole } from "./entity-media-card";

// ─────────────────────────────────────────────────────────────────────────
// EntityCardAccordion — single-open grid for EntityMediaCard surfaces.
//
// Generalized from the Access `cockpit-grid.tsx`. When one card is expanded it
// is the ONLY card rendered (full-width, `grid-cols-1`); every other card
// returns null — "open one, hide the rest". Collapsed, all cards render in a
// responsive grid. The actual morph between the two layouts is the View
// Transition driven by `withViewTransition({ expandClass: true })` in the
// parent that owns `expandedId`.
//
// `collapsedClassName` lets each surface pick its collapsed grid: Access uses
// the default 1/2-col; Spaces passes its auto-fill card grid. The expanded
// layout is always a single full-width column.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_COLLAPSED_GRID = "grid gap-3 grid-cols-1 md:grid-cols-2";
const EXPANDED_GRID = "grid gap-3 grid-cols-1";

interface EntityCardAccordionProps {
  expandedId: string | null;
  ids: readonly string[];
  /** Collapsed-state grid classes. Defaults to a 1/2-col responsive grid. */
  collapsedClassName?: string;
  children: (id: string, role: EntityCardRole) => ReactNode;
}

export function EntityCardAccordion({
  expandedId,
  ids,
  collapsedClassName,
  children,
}: EntityCardAccordionProps) {
  const expanded = expandedId !== null;
  return (
    <div className={expanded ? EXPANDED_GRID : collapsedClassName ?? DEFAULT_COLLAPSED_GRID}>
      {ids.map((id) => {
        const isActive = expandedId === id;
        if (expanded && !isActive) return null;
        const role: EntityCardRole = isActive ? "active" : "idle";
        return <div key={id}>{children(id, role)}</div>;
      })}
    </div>
  );
}
