import type { GuideSection } from "@/lib/types/guide-tree";
import { getJourneyStageLabel } from "@/lib/taxonomy-loader";
import { GuideItem } from "./guide-item";
import { GuideEmptyState } from "./guide-empty-state";

interface Props {
  section: GuideSection;
}

/**
 * Default section renderer. Specialized renderers (essentials, emergency,
 * local) override this entry in `public-guide-section-registry`. The section
 * id doubles as the anchor target for the TOC scrollspy.
 */
export function SectionCard({ section }: Props) {
  const isHero = !!section.isHero;
  return (
    <section
      id={section.id}
      className={`guide-section${isHero ? " guide-section--hero" : ""}`}
      aria-labelledby={`${section.id}-title`}
    >
      <header className="guide-section__header">
        <h2 id={`${section.id}-title`} className="guide-section__title">
          {section.label}
        </h2>
        {section.journeyStage && (
          <span className="guide-section__stage">
            {getJourneyStageLabel(section.journeyStage)}
          </span>
        )}
      </header>
      {section.items.length === 0 ? (
        <GuideEmptyState copy={section.emptyCopy} />
      ) : (
        <div className="guide-items">
          {section.items.map((item) => (
            <GuideItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
