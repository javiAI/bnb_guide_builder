"use client";

import { EntityCardAccordion } from "@/components/ui/entity-card-accordion";
import { useCockpitAccordion } from "@/lib/use-cockpit-accordion";
import { SpaceCard, type SpaceStatus } from "./space-card";
import type { BedData } from "./bed-manager";
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
  spaceSystems: { id: string; systemKey: string; label: string }[];
  slides: SpaceMediaSlide[];
  photoCount: number;
  videoCount: number;
}

// Auto-fill card grid — up to 3 cols at the audited content width; one full-
// width card when expanded (handled by EntityCardAccordion).
const SPACES_GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4";

/**
 * Client island for a space-card cockpit grid (active or archived). Owns the
 * single-open accordion state (expand morphs via View Transition; collapses on
 * Escape / click-outside) so the server page stays a server component.
 */
export function SpacesGrid({
  propertyId,
  maxGuests,
  cards,
}: {
  propertyId: string;
  maxGuests: number | null;
  cards: SpaceCardData[];
}) {
  const { expandedId, setExpanded, wrapperRef } = useCockpitAccordion();
  return (
    <div ref={wrapperRef}>
      <EntityCardAccordion
        expandedId={expandedId}
        ids={cards.map((c) => c.space.id)}
        collapsedClassName={SPACES_GRID}
      >
        {(id, role) => {
          const card = cards.find((c) => c.space.id === id);
          if (!card) return null;
          return (
            <SpaceCard
              propertyId={propertyId}
              maxGuests={maxGuests}
              role={role}
              onExpand={() => setExpanded(id)}
              onCollapse={() => setExpanded(null)}
              space={card.space}
              beds={card.beds}
              spaceSystems={card.spaceSystems}
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
