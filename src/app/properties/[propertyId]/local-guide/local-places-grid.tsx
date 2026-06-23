"use client";

import { useMemo } from "react";
import { EntityCardAccordion } from "@/components/ui/entity-card-accordion";
import { useCockpitAccordion } from "@/lib/use-cockpit-accordion";
import { getLocalPlaceIcon } from "@/lib/icons/local-place-icons";
import {
  LocalPlaceCard,
  type LocalPlaceData,
  type LocalPlaceCategoryOption,
} from "./local-place-card";

/** Per-category group prepared by the server page (taxonomy order). */
export interface LocalPlaceGroupData {
  categoryKey: string;
  label: string;
  places: LocalPlaceData[];
}

/**
 * Client island for the local-places cockpit. ONE `useCockpitAccordion` shared
 * across every category group: expanding a card renders it alone (the sibling
 * groups' accordions go empty by design), so groups that don't contain the
 * expanded card are hidden whole — subheader included — to avoid orphan
 * headers over empty grids. Collapses on Escape / click-outside.
 */
export function LocalPlacesGrid({
  propertyId,
  groups,
  categoryOptions,
}: {
  propertyId: string;
  groups: LocalPlaceGroupData[];
  categoryOptions: ReadonlyArray<LocalPlaceCategoryOption>;
}) {
  const { expandedId, setExpanded, wrapperRef } = useCockpitAccordion();
  const byId = useMemo(
    () =>
      new Map(
        groups.flatMap((g) => g.places.map((p) => [p.id, p] as const)),
      ),
    [groups],
  );
  return (
    <div ref={wrapperRef} className="space-y-6">
      {groups.map((group) => {
        const ids = group.places.map((p) => p.id);
        if (expandedId !== null && !ids.includes(expandedId)) return null;
        const GroupIcon = getLocalPlaceIcon(group.categoryKey);
        return (
          <section key={group.categoryKey} aria-label={group.label}>
            <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              <GroupIcon
                size={14}
                aria-hidden="true"
                className="text-[var(--color-text-muted)]"
              />
              {group.label}
              <span className="font-normal text-[var(--color-text-muted)]">
                · {group.places.length}
              </span>
            </h3>
            <EntityCardAccordion expandedId={expandedId} ids={ids}>
              {(id, role) => {
                const place = byId.get(id);
                if (!place) return null;
                return (
                  <LocalPlaceCard
                    propertyId={propertyId}
                    place={place}
                    categoryOptions={categoryOptions}
                    role={role}
                    onExpand={() => setExpanded(id)}
                    onCollapse={() => setExpanded(null)}
                  />
                );
              }}
            </EntityCardAccordion>
          </section>
        );
      })}
    </div>
  );
}
