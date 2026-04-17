import type { GuideSection } from "@/lib/types/guide-tree";
import { EMERGENCY_FIELD_LABELS } from "@/lib/types/guide-tree";
import { GuideEmptyState } from "./guide-empty-state";

interface Props {
  section: GuideSection;
}

/** Specialized renderer for "Ayuda y emergencias". Phone and email are
 * promoted to tappable `tel:` / `mailto:` links so a guest needing help gets
 * one tap — not a copy-paste dance. Non-contact fields fall through to the
 * standard definition-list layout. */
export function GuideEmergencySection({ section }: Props) {
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
          {section.items.map((item) => {
            const phone = item.fields.find((f) => f.label === EMERGENCY_FIELD_LABELS.phone)?.value;
            const email = item.fields.find((f) => f.label === EMERGENCY_FIELD_LABELS.email)?.value;
            const notes = item.fields.find((f) => f.label === EMERGENCY_FIELD_LABELS.notes)?.value;
            return (
              <article key={item.id} className="guide-item" id={`item-${item.id}`}>
                <h3 className="guide-item__label">{item.label}</h3>
                <div className="guide-contact">
                  {phone && (
                    <a
                      className="guide-contact__link"
                      href={`tel:${phone.replace(/\s+/g, "")}`}
                    >
                      {phone}
                    </a>
                  )}
                  {email && (
                    <a className="guide-contact__link" href={`mailto:${email}`}>
                      {email}
                    </a>
                  )}
                  {notes && <p className="guide-contact__notes">{notes}</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
