"use client";

import { type ReactNode } from "react";
import type { EntityCardRole } from "./entity-media-card";

// ─────────────────────────────────────────────────────────────────────────
// EntityCardAccordion — single-open grid for EntityMediaCard surfaces.
//
// Generalized from the Access `cockpit-grid.tsx`. When one card is expanded it
// is the ONLY card rendered (full-width, single column); every other card
// returns null — "open one, hide the rest". The morph between the two layouts
// is the View Transition driven by `useCockpitAccordion` in the parent.
//
// Collapsed, cards lay out via the shared `recipe-entity-card-grid`
// (container-query: 1 / 2 / 4 columns by the HOST width, never 3) so Spaces,
// Access and future surfaces share one responsive behavior. The host carries
// `container-type` so the column count tracks the content container, not the
// viewport.
// ─────────────────────────────────────────────────────────────────────────

interface EntityCardAccordionProps {
  expandedId: string | null;
  ids: readonly string[];
  children: (id: string, role: EntityCardRole) => ReactNode;
}

export function EntityCardAccordion({ expandedId, ids, children }: EntityCardAccordionProps) {
  const expanded = expandedId !== null;
  return (
    <div className="recipe-entity-card-grid-host">
      <div className={expanded ? "grid grid-cols-1 gap-[0.875rem]" : "recipe-entity-card-grid"}>
        {ids.map((id) => {
          const isActive = expandedId === id;
          if (expanded && !isActive) return null;
          const role: EntityCardRole = isActive ? "active" : "idle";
          return <div key={id} className="min-w-0">{children(id, role)}</div>;
        })}
      </div>
    </div>
  );
}
