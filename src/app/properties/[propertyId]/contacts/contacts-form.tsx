"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Plus, Siren, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { createContactAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { cn } from "@/lib/cn";
import { contactTypes } from "@/lib/contact-types-loader";
import { contactGroupTone } from "@/lib/icons/contact-icons";
import { ContactCard, type Contact } from "./_components/contact-card";
import { ContactTypeSelect, FormErrors } from "./_components/contact-form-bits";
import { FIELD, FIELD_PH, PRIMARY_BTN } from "./_components/styles";

interface ContactsFormProps {
  propertyId: string;
  contacts: Contact[];
}

const groups = contactTypes.groups;
const typeItems = contactTypes.items;

function groupIdFor(roleKey: string): string {
  return typeItems.find((t) => t.id === roleKey)?.group ?? "ctg.other";
}

// Presentation-only section order: operations first, emergency second, then
// every other group in its taxonomy order. Matches the kit hierarchy (the
// ported subtitle frames emergency as "lo primero que mira el huésped si algo
// va mal"). The taxonomy itself is untouched — this is purely how sections are
// surfaced on this page.
const PINNED_SECTIONS = ["ctg.operations", "ctg.emergency"];

function sectionRank(groupId: string): number {
  const pinned = PINNED_SECTIONS.indexOf(groupId);
  return pinned !== -1
    ? pinned
    : PINNED_SECTIONS.length + groups.findIndex((g) => g.id === groupId);
}

function CreateContactForm({
  propertyId,
  onClose,
}: {
  propertyId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createContactAction,
    null,
  );

  return (
    <div className="rounded-[var(--radius-lg)] border-2 border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] p-4">
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">Nuevo contacto</h3>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="propertyId" value={propertyId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Tipo *</span>
            <ContactTypeSelect required autoFocus />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Nombre *</span>
            <input name="displayName" type="text" required placeholder="Nombre de la persona o empresa" className={FIELD_PH} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium">Teléfono</span>
            <input name="phone" type="tel" placeholder="+34 600 000 000" className={FIELD_PH} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input name="email" type="email" className={FIELD} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">WhatsApp</span>
            <input name="whatsapp" type="tel" placeholder="+34 600 000 000" className={FIELD_PH} />
          </label>
        </div>

        <input type="hidden" name="entityType" value="person" />
        <input type="hidden" name="visibility" value="internal" />

        <FormErrors state={state} />

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={PRIMARY_BTN}>
            {pending ? "Creando..." : "Crear contacto"}
          </button>
          <button type="button" onClick={onClose} className="inline-flex min-h-[44px] items-center px-1 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export function ContactsForm({ propertyId, contacts }: ContactsFormProps) {
  const [creating, setCreating] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (creating) {
      createRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [creating]);

  const contactsByGroup = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const groupId = groupIdFor(contact.roleKey);
    const arr = contactsByGroup.get(groupId) ?? [];
    arr.push(contact);
    contactsByGroup.set(groupId, arr);
  }

  // D1: numbered sections over non-empty groups, ordered per sectionRank.
  const nonEmptyGroups = groups
    .filter((g) => (contactsByGroup.get(g.id)?.length ?? 0) > 0)
    .sort((a, b) => sectionRank(a.id) - sectionRank(b.id));

  const emergencyCount = contactsByGroup.get("ctg.emergency")?.length ?? 0;
  const guestVisibleCount = contacts.filter((c) => c.visibility === "guest").length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href={`/properties/${propertyId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Volver al panel
      </Link>

      <PageHeader
        eyebrow="Propiedad · Contactos"
        title="Contactos"
        description="Quién responde, quién limpia, quién arregla. Mantén esta lista al día — es lo primero que mira el huésped si algo va mal."
        actions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={cn(PRIMARY_BTN, "gap-1.5")}
          >
            <Plus size={15} aria-hidden="true" />
            Añadir contacto
          </button>
        }
        chips={
          <>
            <PageHeaderChip icon={Users} label="Contactos" value={contacts.length} />
            {emergencyCount > 0 && (
              <PageHeaderChip icon={Siren} label="Emergencia" value={emergencyCount} />
            )}
            {guestVisibleCount > 0 && (
              <PageHeaderChip icon={Eye} label="En la guía" value={guestVisibleCount} />
            )}
          </>
        }
      />

      {nonEmptyGroups.map((group, idx) => {
        const groupContacts = contactsByGroup.get(group.id) ?? [];
        const tone = contactGroupTone(group.id);
        return (
          <NumberedSection
            key={group.id}
            number={String(idx + 1).padStart(2, "0")}
            title={group.label}
            action={
              group.id === "ctg.emergency" ? (
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  Siempre visibles en la guía
                </span>
              ) : undefined
            }
          >
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
              {groupContacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  propertyId={propertyId}
                  tone={tone}
                />
              ))}
            </div>
          </NumberedSection>
        );
      })}

      {contacts.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-default)] bg-[var(--color-background-muted)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Aún no hay contactos. Añade el anfitrión y los contactos clave para que el huésped sepa a quién acudir.
          </p>
        </div>
      )}

      {creating && (
        <div ref={createRef} className="scroll-mt-6 mt-6">
          <CreateContactForm propertyId={propertyId} onClose={() => setCreating(false)} />
        </div>
      )}
    </div>
  );
}
