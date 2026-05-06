"use client";

import { type ReactNode } from "react";

export type CardRole = "idle" | "active";

interface CockpitGridProps {
  expandedId: string | null;
  ids: readonly string[];
  children: (id: string, role: CardRole) => ReactNode;
}

export function CockpitGrid({ expandedId, ids, children }: CockpitGridProps) {
  const expanded = expandedId !== null;
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: expanded ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))",
      }}
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
