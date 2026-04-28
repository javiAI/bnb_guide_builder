import type {
  GuideAudience,
  GuideItem as GuideItemType,
  GuideSection,
} from "@/lib/types/guide-tree";
import { EMERGENCY_FIELD_LABELS } from "@/lib/types/guide-tree";
import { buildMailtoHref, buildTelHref } from "@/lib/contact-actions";
import {
  resolveDisplayFields,
  resolveEmptyCopy,
} from "@/lib/renderers/_guide-display";
import { GuideEmptyState } from "./guide-empty-state";
import { WarningCard } from "./ui/guide-card";

interface Props {
  section: GuideSection;
  renderable: GuideItemType[];
  audience: GuideAudience;
}

export function GuideEmergencySection({ section, renderable, audience }: Props) {
  const emptyCopy = resolveEmptyCopy(section, audience);
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
      {renderable.length === 0 ? (
        <GuideEmptyState copy={emptyCopy ?? undefined} />
      ) : (
        <div className="guide-items">
          {renderable.map((item) => {
            const fields = resolveDisplayFields(item);
            const phone = fields.find((f) => f.label === EMERGENCY_FIELD_LABELS.phone)?.value;
            const email = fields.find((f) => f.label === EMERGENCY_FIELD_LABELS.email)?.value;
            const notes = fields.find((f) => f.label === EMERGENCY_FIELD_LABELS.notes)?.value;
            const mailto = email ? buildMailtoHref(email) : null;
            return (
              <WarningCard key={item.id} className="guide-item" id={`item-${item.id}`}>
                <h3 className="guide-item__label">{item.label}</h3>
                <div className="guide-contact">
                  {phone && (
                    <a
                      className="guide-contact__link"
                      href={buildTelHref(phone)}
                    >
                      {phone}
                    </a>
                  )}
                  {mailto && (
                    <a className="guide-contact__link" href={mailto}>
                      {email}
                    </a>
                  )}
                  {notes && <p className="guide-contact__notes">{notes}</p>}
                </div>
              </WarningCard>
            );
          })}
        </div>
      )}
    </section>
  );
}
