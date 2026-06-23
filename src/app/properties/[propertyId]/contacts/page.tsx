import { redirect } from "next/navigation";
import { CheckCheck, Eye, Siren, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip, countChipLabel } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { contactTypes } from "@/lib/contact-types-loader";
import { ContactsSections, type ContactSectionData } from "./_components/contacts-sections";
import { AddContactChips } from "./_components/add-contact-chips";
import { computeContactStatus } from "./_components/contact-progress";
import type { Contact } from "./_components/contact-card";

interface Props {
  params: Promise<{ propertyId: string }>;
}

const groups = contactTypes.groups;
const typeItems = contactTypes.items;

function groupIdFor(roleKey: string): string {
  return typeItems.find((t) => t.id === roleKey)?.group ?? "ctg.other";
}

// Presentation-only section order: operations first, emergency second, then
// every other group in its taxonomy order. The taxonomy itself is untouched.
const PINNED_SECTIONS = ["ctg.operations", "ctg.emergency"];

function sectionRank(groupId: string): number {
  const pinned = PINNED_SECTIONS.indexOf(groupId);
  return pinned !== -1
    ? pinned
    : PINNED_SECTIONS.length + groups.findIndex((g) => g.id === groupId);
}

export default async function ContactsPage({ params }: Props) {
  const { propertyId } = await params;

  const [property, contacts] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } }),
    prisma.contact.findMany({
      where: { propertyId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        roleKey: true,
        entityType: true,
        displayName: true,
        contactPersonName: true,
        phone: true,
        phoneSecondary: true,
        email: true,
        whatsapp: true,
        address: true,
        availabilitySchedule: true,
        emergencyAvailable: true,
        hasPropertyAccess: true,
        internalNotes: true,
        guestVisibleNotes: true,
        visibility: true,
        isPrimary: true,
      },
    }),
  ]);

  if (!property) redirect("/");

  // ── Group + order non-empty sections ──
  const contactsByGroup = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const groupId = groupIdFor(contact.roleKey);
    const arr = contactsByGroup.get(groupId) ?? [];
    arr.push(contact);
    contactsByGroup.set(groupId, arr);
  }
  const nonEmptyGroups = groups
    .filter((g) => (contactsByGroup.get(g.id)?.length ?? 0) > 0)
    .sort((a, b) => sectionRank(a.id) - sectionRank(b.id));

  const sections: ContactSectionData[] = nonEmptyGroups.map((g, idx) => ({
    groupId: g.id,
    number: String(idx + 1).padStart(2, "0"),
    title: g.label,
    contacts: contactsByGroup.get(g.id) ?? [],
  }));

  // ── Header chips (real data) ──
  const total = contacts.length;
  const emergencyCount = contactsByGroup.get("ctg.emergency")?.length ?? 0;
  const guestVisibleCount = contacts.filter((c) => c.visibility === "guest").length;
  const readyCount = contacts.filter((c) => computeContactStatus(c) === "complete").length;

  // Add-section sits after the numbered group sections (or after the empty
  // state). When there are contacts it follows section N; the empty state is
  // section 01 so the add control is 02.
  const addNumber = total > 0 ? String(sections.length + 1).padStart(2, "0") : "02";

  // Add-chips groups: every contact-type group in sectionRank order, each item
  // is a contact type with its label. Repeatable (a chip can be pressed N times).
  const orderedGroups = [...groups].sort((a, b) => sectionRank(a.id) - sectionRank(b.id));
  const addGroups = orderedGroups.map((g) => ({
    label: g.label,
    items: typeItems.filter((t) => t.group === g.id).map((t) => ({ id: t.id, label: t.label })),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Propiedad · Contactos"
        title="Contactos"
        description="Quién responde, quién limpia, quién arregla. Mantén esta lista al día — es lo primero que mira el huésped si algo va mal."
        chips={
          <>
            <PageHeaderChip icon={Users} label={countChipLabel(total, "contacto", "contactos")} />
            {emergencyCount > 0 && (
              <PageHeaderChip
                icon={Siren}
                label={
                  <>
                    <span className="font-semibold text-[var(--color-text-primary)]">{emergencyCount}</span>{" "}
                    de emergencia
                  </>
                }
              />
            )}
            {guestVisibleCount > 0 && (
              <PageHeaderChip
                icon={Eye}
                label={
                  <>
                    <span className="font-semibold text-[var(--color-text-primary)]">{guestVisibleCount}</span>{" "}
                    en la guía
                  </>
                }
              />
            )}
            {total > 0 && (
              <PageHeaderChip
                icon={CheckCheck}
                label={
                  <>
                    <span className="font-semibold text-[var(--color-text-primary)]">{readyCount}</span>{" "}
                    de {total} listos
                  </>
                }
              />
            )}
          </>
        }
      />

      {total === 0 ? (
        <NumberedSection number="01" title="Contactos">
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] px-8 py-12 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[var(--color-action-primary-subtle)]">
              <Users size={20} aria-hidden="true" className="text-[var(--color-action-primary)]" />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Aún no hay contactos
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--color-text-secondary)]">
              Empieza por el anfitrión. Cada contacto que añadas tendrá su tarjeta con teléfono, email y disponibilidad.
            </p>
          </div>
        </NumberedSection>
      ) : (
        <ContactsSections propertyId={propertyId} sections={sections} />
      )}

      <NumberedSection number={addNumber} title="Añadir contacto">
        <AddContactChips propertyId={propertyId} groups={addGroups} />
      </NumberedSection>
    </div>
  );
}
