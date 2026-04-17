import type { GuideSection } from "@/lib/types/guide-tree";
import { GuideItem } from "./guide-item";
import { GuideEmptyState } from "./guide-empty-state";

interface Props {
  section: GuideSection;
}

/** Local guide section — falls through to the standard item layout for now.
 * The map surface will plug in here (Rama 13D) by replacing the `<div/>`
 * placeholder with the real component. Left as a dedicated entry in the
 * registry so the swap is a one-line change. */
export function GuideLocalSection({ section }: Props) {
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
