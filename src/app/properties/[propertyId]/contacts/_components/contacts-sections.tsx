"use client";

import { useMemo } from "react";
import { NumberedSection } from "@/components/ui/numbered-section";
import { EntityCardAccordion } from "@/components/ui/entity-card-accordion";
import { useCockpitAccordion } from "@/lib/use-cockpit-accordion";
import { contactGroupTone } from "@/lib/icons/contact-icons";
import { ContactCard, type Contact } from "./contact-card";

export interface ContactSectionData {
  groupId: string;
  /** Displayed number ("01", "02"…) — assigned by the server page. */
  number: string;
  title: string;
  contacts: Contact[];
}

/**
 * Client island for the contacts cockpit grid. Owns a SINGLE page-wide
 * single-open accordion (`useCockpitAccordion`, wrapperRef around every
 * section); each section renders its own EntityCardAccordion but receives the
 * expandedId *scoped* to its own ids (`ids.includes(expandedId) ? expandedId :
 * null`). That keeps single-open guaranteed page-wide (including via keyboard,
 * which doesn't fire mousedown) while collapsing only the active card's
 * section siblings, never the other sections.
 */
export function ContactsSections({
  propertyId,
  sections,
}: {
  propertyId: string;
  sections: ContactSectionData[];
}) {
  const { expandedId, setExpanded, wrapperRef } = useCockpitAccordion();
  const byId = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const s of sections) for (const c of s.contacts) map.set(c.id, c);
    return map;
  }, [sections]);

  return (
    <div ref={wrapperRef}>
      {sections.map((section) => {
        const ids = section.contacts.map((c) => c.id);
        const scopedExpanded = expandedId && ids.includes(expandedId) ? expandedId : null;
        const tone = contactGroupTone(section.groupId);
        return (
          <NumberedSection
            key={section.groupId}
            number={section.number}
            title={section.title}
            action={
              section.groupId === "ctg.emergency" ? (
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  Siempre visibles en la guía
                </span>
              ) : undefined
            }
          >
            <EntityCardAccordion expandedId={scopedExpanded} ids={ids}>
              {(id, role) => {
                const contact = byId.get(id);
                if (!contact) return null;
                return (
                  <ContactCard
                    propertyId={propertyId}
                    contact={contact}
                    tone={tone}
                    role={role}
                    onExpand={() => setExpanded(id)}
                    onCollapse={() => setExpanded(null)}
                  />
                );
              }}
            </EntityCardAccordion>
          </NumberedSection>
        );
      })}
    </div>
  );
}
