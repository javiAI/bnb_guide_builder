"use client";

import { useMemo } from "react";
import { EntityCardAccordion } from "@/components/ui/entity-card-accordion";
import { useCockpitAccordion } from "@/lib/use-cockpit-accordion";
import { SpaceCard, type SpaceStatus } from "./space-card";
import type { BedData } from "./bed-manager";
import type { SpaceCoverageSystem } from "./space-systems-coverage";
import type { SpaceMediaSlide } from "@/lib/services/space-media.service";

/** Serializable per-card payload prepared by the server page. */
export interface SpaceCardData {
  space: {
    id: string;
    spaceType: string;
    name: string;
    guestNotes: string | null;
    internalNotes: string | null;
    featuresJson: Record<string, unknown> | null;
    status: SpaceStatus;
  };
  beds: BedData[];
  coverageSystems: SpaceCoverageSystem[];
  slides: SpaceMediaSlide[];
  photoCount: number;
  videoCount: number;
}

/**
 * Client island for a space-card cockpit grid (active or archived). Owns the
 * single-open accordion state (expand morphs via View Transition; collapses on
 * Escape / click-outside) so the server page stays a server component.
 */
export function SpacesGrid({
  propertyId,
  maxGuests,
  propertyBedCapacity,
  propertyAreaSqm,
  propertyCeilingCm,
  cards,
}: {
  propertyId: string;
  maxGuests: number | null;
  propertyBedCapacity: number;
  propertyAreaSqm: number | null;
  propertyCeilingCm: number | null;
  cards: SpaceCardData[];
}) {
  const { expandedId, setExpanded, wrapperRef } = useCockpitAccordion();
  const ids = useMemo(() => cards.map((c) => c.space.id), [cards]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.space.id, c])), [cards]);
  return (
    <div ref={wrapperRef}>
      <EntityCardAccordion expandedId={expandedId} ids={ids}>
        {(id, role) => {
          const card = byId.get(id);
          if (!card) return null;
          return (
            <SpaceCard
              propertyId={propertyId}
              maxGuests={maxGuests}
              propertyBedCapacity={propertyBedCapacity}
              propertyAreaSqm={propertyAreaSqm}
              propertyCeilingCm={propertyCeilingCm}
              role={role}
              onExpand={() => setExpanded(id)}
              onCollapse={() => setExpanded(null)}
              space={card.space}
              beds={card.beds}
              coverageSystems={card.coverageSystems}
              slides={card.slides}
              photoCount={card.photoCount}
              videoCount={card.videoCount}
            />
          );
        }}
      </EntityCardAccordion>
    </div>
  );
}
