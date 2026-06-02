"use client";

import { useActionState } from "react";
import { Phone, Pencil } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { useAutoSaveEditToggle } from "@/lib/use-form-auto-save";
import { DeleteConfirmationButton } from "@/components/ui/delete-confirmation-button";
import { cn } from "@/lib/cn";
import { updateContactAction, deleteContactAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { contactTypes } from "@/lib/contact-types-loader";
import { contactIconFor, type ContactGroupTone } from "@/lib/icons/contact-icons";
import { ContactQuickActions } from "./contact-quick-actions";
import { ContactTypeSelect, FormErrors } from "./contact-form-bits";
import { FIELD, FIELD_PH, PRIMARY_BTN } from "./styles";

export interface Contact {
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

const typeItems = contactTypes.items;

const AVATAR_TONE: Record<ContactGroupTone, string> = {
  primary: "bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary-subtle-fg)]",
  danger: "bg-[var(--color-status-error-bg)] text-[var(--color-status-error-text)]",
  success: "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]",
  neutral: "bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]",
};

function getTypeLabel(roleKey: string): string {
  return typeItems.find((t) => t.id === roleKey)?.label ?? roleKey;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function ContactAvatar({
  contact,
  tone,
}: {
  contact: Contact;
  tone: ContactGroupTone;
}) {
  const Icon = contactIconFor(contact.roleKey);
  const isPerson = contact.entityType === "person";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold",
        AVATAR_TONE[tone],
      )}
    >
      {isPerson ? initials(contact.displayName) : <Icon size={20} />}
    </span>
  );
}

export function ContactCard({
  contact,
  propertyId,
  tone,
}: {
  contact: Contact;
  propertyId: string;
  tone: ContactGroupTone;
}) {
  // Auto-save: edits persist as you make them (no "Guardar" button); the card
  // opens to edit and closes with "Listo" (which flushes the pending save).
  const { editing, formRef, open, close } = useAutoSaveEditToggle();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateContactAction,
    null,
  );

  const typeLabel = getTypeLabel(contact.roleKey);
  const isEmergency = tone === "danger";

  const details: string[] = [];
  if (contact.isPrimary) details.push("Principal");
  if (contact.emergencyAvailable) details.push("Disponible 24h");
  if (contact.availabilitySchedule) details.push(contact.availabilitySchedule);

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-lg)] border p-4 transition-colors",
        editing && "col-span-full",
        isEmergency
          ? "border-[var(--color-status-error-border)] bg-[linear-gradient(135deg,var(--color-status-error-bg),var(--color-background-elevated))]"
          : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-border-strong)]",
      )}
    >
      <div className="flex items-center gap-3">
        <ContactAvatar contact={contact} tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {contact.displayName}
          </div>
          <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
            <span className="font-medium text-[var(--color-text-primary)]">{typeLabel}</span>
            {details.length > 0 && ` · ${details.join(" · ")}`}
          </div>
        </div>
        <IconButton
          icon={Pencil}
          size="md"
          aria-label={editing ? `Cerrar edición de ${contact.displayName}` : `Editar ${contact.displayName}`}
          aria-expanded={editing}
          onClick={() => (editing ? close() : open())}
        />
      </div>

      {contact.phone && (
        <div className="flex items-center gap-1.5 font-mono text-[13px] text-[var(--color-text-primary)]">
          <Phone size={13} aria-hidden="true" className="text-[var(--color-text-muted)]" />
          {contact.phone}
        </div>
      )}

      <ContactQuickActions
        phone={contact.phone}
        email={contact.email}
        whatsapp={contact.whatsapp}
        address={contact.address}
      />

      {editing && (
        <form ref={formRef} action={formAction} className="space-y-4 border-t border-[var(--color-border-subtle)] pt-4">
          <input type="hidden" name="contactId" value={contact.id} />
          <input type="hidden" name="propertyId" value={propertyId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Tipo</span>
              <ContactTypeSelect defaultValue={contact.roleKey} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Persona / Empresa</span>
              <select name="entityType" defaultValue={contact.entityType} className={FIELD}>
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
              <input name="displayName" type="text" required defaultValue={contact.displayName} className={FIELD} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Persona de contacto</span>
              <input name="contactPersonName" type="text" defaultValue={contact.contactPersonName ?? ""} placeholder="Si es empresa, quién llamar" className={FIELD_PH} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium">Teléfono</span>
              <input name="phone" type="tel" defaultValue={contact.phone ?? ""} placeholder="+34 600 000 000" className={FIELD_PH} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input name="email" type="email" defaultValue={contact.email ?? ""} className={FIELD} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">WhatsApp</span>
              <input name="whatsapp" type="tel" defaultValue={contact.whatsapp ?? ""} placeholder="+34 600 000 000" className={FIELD_PH} />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Disponibilidad</span>
            <input name="availabilitySchedule" type="text" defaultValue={contact.availabilitySchedule ?? ""} placeholder="ej. L-V 9:00-18:00" className={FIELD_PH} />
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="emergencyAvailable" defaultChecked={contact.emergencyAvailable} className="h-4 w-4 accent-[var(--color-action-primary)]" />
              <span className="text-sm">Disponible 24h</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="hasPropertyAccess" defaultChecked={contact.hasPropertyAccess} className="h-4 w-4 accent-[var(--color-action-primary)]" />
              <span className="text-sm">Tiene acceso a la propiedad</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="isPrimary" defaultChecked={contact.isPrimary} className="h-4 w-4 accent-[var(--color-action-primary)]" />
              <span className="text-sm">Contacto principal</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Notas internas</span>
              <textarea name="internalNotes" rows={2} defaultValue={contact.internalNotes ?? ""} placeholder="Información privada (tarifas, contrato, etc.)" className={FIELD_PH} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Notas para huéspedes</span>
              <textarea name="guestVisibleNotes" rows={2} defaultValue={contact.guestVisibleNotes ?? ""} placeholder="Información visible para el huésped" className={FIELD_PH} />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Visibilidad</span>
            <select name="visibility" defaultValue={contact.visibility} className={FIELD}>
              <option value="internal">Solo interno</option>
              <option value="guest">Visible para huéspedes</option>
              <option value="sensitive">Sensible</option>
            </select>
          </label>

          <FormErrors state={state} />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button type="button" onClick={close} className={PRIMARY_BTN}>
                Listo
              </button>
              <AutoSaveStatus pending={pending} />
            </div>
            <DeleteConfirmationButton
              title="Eliminar contacto"
              description={`Se eliminará ${contact.displayName}. Esta acción no se puede deshacer.`}
              entityId={contact.id}
              fieldName="contactId"
              action={deleteContactAction as (prev: { success: boolean } | null, formData: FormData) => Promise<{ success: boolean }>}
            />
          </div>
        </form>
      )}
    </article>
  );
}
