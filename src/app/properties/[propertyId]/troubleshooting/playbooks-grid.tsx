"use client";

import { useMemo, useRef } from "react";
import { EntityCardAccordion } from "@/components/ui/entity-card-accordion";
import { useCockpitAccordion } from "@/lib/use-cockpit-accordion";
import {
  PlaybookCard,
  type PlaybookData,
  type PlaybookTargetOptions,
} from "./playbook-card";

/** Serializable per-card payload prepared by the server page. */
export interface PlaybookCardData {
  playbook: PlaybookData;
  /** Open/in-progress incidents linked to this playbook. */
  openIncidents: number;
}

/**
 * Client island for the playbooks cockpit grid. Owns the single-open accordion
 * state (expand morphs via View Transition; collapses on Escape / click-outside)
 * plus a grid-owned `flushRef`: the active card registers its autosave `flush()`
 * there, and every collapse path persists the last keystroke before the form
 * unmounts (belt-and-suspenders with the hook's flush-on-unmount).
 */
export function PlaybooksGrid({
  propertyId,
  cards,
  targetOptions,
}: {
  propertyId: string;
  cards: PlaybookCardData[];
  targetOptions: PlaybookTargetOptions;
}) {
  const flushRef = useRef<(() => void) | null>(null);
  const { expandedId, setExpanded, wrapperRef } = useCockpitAccordion({
    onExpandChange: (next) => {
      if (next === null) flushRef.current?.();
    },
  });
  const ids = useMemo(() => cards.map((c) => c.playbook.id), [cards]);
  const byId = useMemo(
    () => new Map(cards.map((c) => [c.playbook.id, c])),
    [cards],
  );
  return (
    <div ref={wrapperRef}>
      <EntityCardAccordion expandedId={expandedId} ids={ids}>
        {(id, role) => {
          const card = byId.get(id);
          if (!card) return null;
          return (
            <PlaybookCard
              propertyId={propertyId}
              playbook={card.playbook}
              openIncidents={card.openIncidents}
              targetOptions={targetOptions}
              role={role}
              onExpand={() => setExpanded(id)}
              onCollapse={() => setExpanded(null)}
              flushRef={flushRef}
            />
          );
        }}
      </EntityCardAccordion>
    </div>
  );
}
