import type {
  GuideAudience,
  GuideItem as GuideItemType,
  GuideSection,
} from "@/lib/types/guide-tree";
import type {
  GuideLocalEventsData,
  GuideMapData,
} from "@/lib/types/guide-map";
import { resolveEmptyCopy } from "@/lib/renderers/_guide-display";
import { GuideItem } from "./guide-item";
import { GuideEmptyState } from "./guide-empty-state";
import { GuideLocalEventCard } from "./guide-local-event-card";
import { GuideMap } from "./guide-map-loader";

interface Props {
  section: GuideSection;
  renderable: GuideItemType[];
  audience: GuideAudience;
  mapData: GuideMapData | null;
  eventsData: GuideLocalEventsData;
}

export function GuideLocalSection({
  section,
  renderable,
  audience,
  mapData,
  eventsData,
}: Props) {
  const emptyCopy = resolveEmptyCopy(section, audience);
  // Config-driven gates: the section renders the map only when its taxonomy
  // entry declares `includesMap: true`, and the events list only when
  // `includesEvents: true`. Flipping these in `guide_sections.json` is the
  // supported way to enable/disable the sub-renderers.
  const mapEnabled = section.includesMap === true;
  const eventsEnabled = section.includesEvents === true;
  const hasMap =
    mapEnabled &&
    mapData !== null &&
    (mapData.anchor !== null || mapData.pins.length > 0);
  const hasEvents = eventsEnabled && eventsData.items.length > 0;
  const hasPlaces = renderable.length > 0;

  return (
    <section
      id={section.id}
      className="guide-section"
      aria-labelledby={`${section.id}-title`}
    >
      <header className="guide-section__header">
        <h2 id={`${section.id}-title`} className="guide-section__title">
          {section.label}
        </h2>
      </header>
      <div className="guide-local">
        {hasMap ? <GuideMap data={mapData} /> : null}
        {hasPlaces ? (
          <div className="guide-items">
            {renderable.map((item) => (
              <GuideItem key={item.id} item={item} />
            ))}
          </div>
        ) : null}
        {hasEvents ? (
          <div className="guide-events" aria-label="Próximos eventos">
            {eventsData.items.map((event) => (
              <GuideLocalEventCard key={event.id} event={event} />
            ))}
          </div>
        ) : null}
        {!hasMap && !hasPlaces && !hasEvents ? (
          <GuideEmptyState copy={emptyCopy ?? undefined} />
        ) : null}
      </div>
    </section>
  );
}
