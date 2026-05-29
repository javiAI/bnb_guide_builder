"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { DeleteConfirmationButton } from "@/components/ui/delete-confirmation-button";
import { createContactAction, updateContactAction, deleteContactAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { contactTypes } from "@/lib/contact-types-loader";

interface Contact {
  id: string;
  roleKey: string;
  entityType: string;
  displayName: string;
  contactPersonName: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  email: string | null;
  whatsapp: string | null;
  address: string | null;
  availabilitySchedule: string | null;
  emergencyAvailable: boolean;
  hasPropertyAccess: boolean;
  internalNotes: string | null;
  guestVisibleNotes: string | null;
  visibility: string;
  isPrimary: boolean;
}

interface ContactsFormProps {
  propertyId: string;
  contacts: Contact[];
}

const groups = contactTypes.groups;
const typeItems = contactTypes.items;

function getTypeLabel(roleKey: string): string {
  return typeItems.find((t) => t.id === roleKey)?.label ?? roleKey;
}

function ContactCard({ contact, propertyId }: { contact: Contact; propertyId: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(updateContactAction, null);

  const typeLabel = getTypeLabel(contact.roleKey);
  const summary = [contact.phone, contact.email].filter(Boolean).join(" · ");

  return (
    <CollapsibleSection
      title={`${typeLabel}${contact.isPrimary ? " (principal)" : ""}`}
      selectedLabel={editing ? null : (contact.displayName + (summary ? ` · ${summary}` : ""))}
      expanded={editing}
      onToggle={() => setEditing(!editing)}
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="contactId" value={contact.id} />
        <input type="hidden" name="propertyId" value={propertyId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Tipo</span>
            <select name="roleKey" defaultValue={contact.roleKey} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm">
              {groups.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {typeItems.filter((t) => t.group === g.id).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Persona / Empresa</span>
            <select name="entityType" defaultValue={contact.entityType} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm">
              <option value="person">Persona</option>
              <option value="company">Empresa</option>
              <option value="institution">Institución</option>
              <option value="platform">Plataforma</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Nombre *</span>
            <input name="displayName" type="text" required defaultValue={contact.displayName} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Persona de contacto</span>
            <input name="contactPersonName" type="text" defaultValue={contact.contactPersonName ?? ""} placeholder="Si es empresa, quién llamar" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-text-placeholder)]" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium">Teléfono</span>
            <input name="phone" type="tel" defaultValue={contact.phone ?? ""} placeholder="+34 600 000 000" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-text-placeholder)]" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input name="email" type="email" defaultValue={contact.email ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">WhatsApp</span>
            <input name="whatsapp" type="tel" defaultValue={contact.whatsapp ?? ""} placeholder="+34 600 000 000" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-text-placeholder)]" />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Disponibilidad</span>
          <input name="availabilitySchedule" type="text" defaultValue={contact.availabilitySchedule ?? ""} placeholder="ej. L-V 9:00-18:00" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-text-placeholder)]" />
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="emergencyAvailable" defaultChecked={contact.emergencyAvailable} className="h-4 w-4 accent-[var(--color-action-primary)]" />
            <span className="text-sm">Disponible 24h</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="hasPropertyAccess" defaultChecked={contact.hasPropertyAccess} className="h-4 w-4 accent-[var(--color-action-primary)]" />
            <span className="text-sm">Tiene acceso a la propiedad</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="isPrimary" defaultChecked={contact.isPrimary} className="h-4 w-4 accent-[var(--color-action-primary)]" />
            <span className="text-sm">Contacto principal</span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Notas internas</span>
            <textarea name="internalNotes" rows={2} defaultValue={contact.internalNotes ?? ""} placeholder="Información privada (tarifas, contrato, etc.)" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-text-placeholder)]" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Notas para huéspedes</span>
            <textarea name="guestVisibleNotes" rows={2} defaultValue={contact.guestVisibleNotes ?? ""} placeholder="Información visible para el huésped" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-text-placeholder)]" />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Visibilidad</span>
          <select name="visibility" defaultValue={contact.visibility} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm">
            <option value="internal">Solo interno</option>
            <option value="guest">Visible para huéspedes</option>
            <option value="sensitive">Sensible</option>
          </select>
        </label>

        {state?.error && <p className="text-sm text-[var(--color-status-error-text)]">{state.error}</p>}
        {state?.fieldErrors && Object.entries(state.fieldErrors).map(([field, errors]) => (
          <p key={field} className="text-sm text-[var(--color-status-error-text)]">{errors?.[0]}</p>
        ))}

        <div className="flex items-center justify-between">
          <button type="submit" disabled={pending} className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-4 text-sm font-medium text-[var(--color-action-primary-fg)] hover:bg-[var(--color-action-primary-hover)] disabled:opacity-40 transition-colors">
            {pending ? "Guardando..." : "Guardar"}
          </button>
          <DeleteConfirmationButton
            title="Eliminar contacto"
            description={`Se eliminará ${contact.displayName}. Esta acción no se puede deshacer.`}
            entityId={contact.id}
            fieldName="contactId"
            action={deleteContactAction as (prev: { success: boolean } | null, formData: FormData) => Promise<{ success: boolean }>}
          />
        </div>
      </form>
    </CollapsibleSection>
  );
}

function CreateContactForm({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createContactAction, null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-default)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)]"
      >
        <Plus size={15} aria-hidden="true" />
        Añadir contacto
      </button>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border-2 border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] p-4">
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">Nuevo contacto</h3>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="propertyId" value={propertyId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Tipo *</span>
            <select name="roleKey" required className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm">
              <option value="">Seleccionar tipo</option>
              {groups.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {typeItems.filter((t) => t.group === g.id).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Nombre *</span>
            <input name="displayName" type="text" required placeholder="Nombre de la persona o empresa" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-text-placeholder)]" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium">Teléfono</span>
            <input name="phone" type="tel" placeholder="+34 600 000 000" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-text-placeholder)]" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input name="email" type="email" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">WhatsApp</span>
            <input name="whatsapp" type="tel" placeholder="+34 600 000 000" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-text-placeholder)]" />
          </label>
        </div>

        <input type="hidden" name="entityType" value="person" />
        <input type="hidden" name="visibility" value="internal" />

        {state?.error && <p className="text-sm text-[var(--color-status-error-text)]">{state.error}</p>}
        {state?.fieldErrors && Object.entries(state.fieldErrors).map(([field, errors]) => (
          <p key={field} className="text-sm text-[var(--color-status-error-text)]">{errors?.[0]}</p>
        ))}

        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-4 text-sm font-medium text-[var(--color-action-primary-fg)] hover:bg-[var(--color-action-primary-hover)] disabled:opacity-40 transition-colors">
            {pending ? "Creando..." : "Crear contacto"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export function ContactsForm({ propertyId, contacts }: ContactsFormProps) {
  const contactsByGroup = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const typeItem = typeItems.find((t) => t.id === contact.roleKey);
    const groupId = typeItem?.group ?? "ctg.other";
    const arr = contactsByGroup.get(groupId) ?? [];
    arr.push(contact);
    contactsByGroup.set(groupId, arr);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Link href={`/properties/${propertyId}`} className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><ArrowLeft size={14} aria-hidden="true" />Volver al panel</Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">Contactos</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Gestiona todos los contactos asociados a la propiedad.</p>
      </div>

      <div className="space-y-6">
        {groups.map((group) => {
          const groupContacts = contactsByGroup.get(group.id);
          if (!groupContacts || groupContacts.length === 0) return null;
          return (
            <div key={group.id}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{group.label}</h2>
              <div className="space-y-2">
                {groupContacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} propertyId={propertyId} />
                ))}
              </div>
            </div>
          );
        })}

        {contacts.length === 0 && (
          <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-default)] bg-[var(--color-background-muted)] p-8 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">No hay contactos configurados. Añade el anfitrión y los contactos que necesites.</p>
          </div>
        )}

        <CreateContactForm propertyId={propertyId} />
      </div>
    </div>
  );
}
