"use client";

import { useCallback, useId, useRef, useState, useActionState, useTransition } from "react";
import { ChevronDown, Clock, Contact as ContactIcon, Eye, Phone } from "lucide-react";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { autoSaveSubmit, useFormAutoSave } from "@/lib/use-form-auto-save";
import { DeleteConfirmationButton } from "@/components/ui/delete-confirmation-button";
import { cn } from "@/lib/cn";
import {
  renameContactAction,
  updateContactAction,
  deleteContactAction,
} from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { contactTypes } from "@/lib/contact-types-loader";
import { contactIconFor, type ContactGroupTone } from "@/lib/icons/contact-icons";
import {
  EntityMediaCard,
  EntityCardStatusPill,
  type EntityCardRole,
} from "@/components/ui/entity-media-card";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { Switch } from "@/components/ui/switch";
import { InlineEditText } from "@/components/ui/inline-edit-text";
import { FieldInput, FieldTextarea, fieldControlClass } from "@/components/ui/field";
import { ContactQuickActions } from "./contact-quick-actions";
import {
  computeContactStatus,
  missingContactSignals,
  STATUS_LABEL,
} from "./contact-progress";

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

function getTypeLabel(roleKey: string): string {
  return typeItems.find((t) => t.id === roleKey)?.label ?? roleKey;
}

// Prisma model enums (not domain taxonomies) — local label records, same
// pattern as Systems. The real catalog (contact types) is the taxonomy.
const ENTITY_TYPE_LABELS: { id: string; label: string }[] = [
  { id: "person", label: "Persona" },
  { id: "company", label: "Empresa" },
  { id: "institution", label: "Institución" },
  { id: "platform", label: "Plataforma" },
];

const VISIBILITY_LABELS: { id: string; label: string }[] = [
  { id: "internal", label: "Solo interno" },
  { id: "guest", label: "Visible en la guía" },
  { id: "sensitive", label: "Sensible" },
];

export function ContactCard({
  contact,
  propertyId,
  tone,
  role,
  onExpand,
  onCollapse,
}: {
  contact: Contact;
  propertyId: string;
  tone: ContactGroupTone;
  role: EntityCardRole;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const TypeIcon = contactIconFor(contact.roleKey);
  const typeLabel = getTypeLabel(contact.roleKey);
  const isEmergency = tone === "danger";

  // ── Status (derived from server props; refreshed on collapse via revalidate) ──
  const status = computeContactStatus(contact);
  const missing = missingContactSignals(contact);
  const statusDetail = missing.length > 0 ? `Falta: ${missing.join(", ")}` : undefined;

  // ── Rename (InlineEditText on the title) ──
  const [renameState, renameAction, renamePending] = useActionState<ActionResult | null, FormData>(
    renameContactAction,
    null,
  );
  const [, startRenameTransition] = useTransition();
  const handleRename = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed || trimmed === contact.displayName) return;
      const fd = new FormData();
      fd.append("contactId", contact.id);
      fd.append("displayName", trimmed);
      startRenameTransition(() => { renameAction(fd); });
    },
    [contact.id, contact.displayName, renameAction],
  );

  // ── Body autosave (mounts only while active) ──
  const detailsFormRef = useRef<HTMLFormElement>(null);
  const flushDetails = useFormAutoSave(detailsFormRef);
  const [detailsState, detailsAction, detailsPending] = useActionState<ActionResult | null, FormData>(
    updateContactAction,
    null,
  );

  // Collapse must flush any debounced edit before the form unmounts — same belt
  // as LocalPlaceCard/PlaybookCard (the unmount cleanup alone races teardown).
  const handleCollapse = useCallback(() => {
    flushDetails();
    onCollapse();
  }, [flushDetails, onCollapse]);

  // ── Controlled state for chips/switches (hidden-mirror) + reveals ──
  const [entityType, setEntityType] = useState(contact.entityType);
  const [visibility, setVisibility] = useState(contact.visibility);
  const [emergencyAvailable, setEmergencyAvailable] = useState(contact.emergencyAvailable);
  const [hasPropertyAccess, setHasPropertyAccess] = useState(contact.hasPropertyAccess);
  const [isPrimary, setIsPrimary] = useState(contact.isPrimary);
  const [showInternalNotes, setShowInternalNotes] = useState(Boolean(contact.internalNotes));
  const [internalNotes, setInternalNotes] = useState(contact.internalNotes ?? "");

  // ── Idle subtitle / collapsed detail ──
  const details: string[] = [];
  if (contact.isPrimary) details.push("Principal");
  if (contact.emergencyAvailable) details.push("Disponible 24h");
  if (contact.availabilitySchedule) details.push(contact.availabilitySchedule);
  const detailSuffix = details.length > 0 ? ` · ${details.join(" · ")}` : "";

  const collapsedContent = (
    <div className="flex w-full flex-col gap-1 pb-12 text-[12px] text-[var(--color-text-secondary)]">
      <span className="min-w-0">
        <span className="font-medium text-[var(--color-text-primary)]">{typeLabel}</span>
        {detailSuffix && <span className="text-[var(--color-text-muted)]">{detailSuffix}</span>}
      </span>
      {contact.phone && (
        <span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--color-text-primary)]">
          <Phone size={13} aria-hidden="true" className="text-[var(--color-text-muted)]" />
          {contact.phone}
        </span>
      )}
    </div>
  );

  // Quick actions are the card's primary value — always visible (not hover-gated).
  const hoverOverlay = (
    <div className="absolute inset-x-4 bottom-3 z-20">
      <ContactQuickActions
        phone={contact.phone}
        email={contact.email}
        whatsapp={contact.whatsapp}
        address={contact.address}
      />
    </div>
  );

  // ── Editor (active only) ──
  const deleteDescription = `Se eliminará "${contact.displayName}". Esta acción no se puede deshacer.`;

  const editor = role !== "active" ? null : (
    <div className="space-y-6">
      {renameState?.error && (
        <p className="-mt-2 text-xs text-[var(--color-status-error-text)]">{renameState.error}</p>
      )}

      <form ref={detailsFormRef} onSubmit={autoSaveSubmit(detailsAction)} className="space-y-6">
        <input type="hidden" name="contactId" value={contact.id} />
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="visibility" value={visibility} />
        <input type="hidden" name="emergencyAvailable" value={emergencyAvailable ? "on" : ""} />
        <input type="hidden" name="hasPropertyAccess" value={hasPropertyAccess ? "on" : ""} />
        <input type="hidden" name="isPrimary" value={isPrimary ? "on" : ""} />

        {/* Canales */}
        <section className="space-y-3">
          <SectionEyebrow icon={Phone}>Canales</SectionEyebrow>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <FieldInput name="phone" type="tel" label="Teléfono" defaultValue={contact.phone ?? ""} placeholder="+34 600 000 000" />
            <FieldInput name="phoneSecondary" type="tel" label="Teléfono secundario" defaultValue={contact.phoneSecondary ?? ""} placeholder="+34 600 000 000" />
            <FieldInput name="whatsapp" type="tel" label="WhatsApp" defaultValue={contact.whatsapp ?? ""} placeholder="+34 600 000 000" />
            <FieldInput name="email" type="email" label="Correo electrónico" defaultValue={contact.email ?? ""} placeholder="contacto@ejemplo.com" />
            <FieldInput
              name="address"
              label="Dirección"
              defaultValue={contact.address ?? ""}
              help="Para contactos con ubicación física (hospital, farmacia…)"
              className="sm:col-span-2"
            />
          </div>
        </section>

        {/* Disponibilidad */}
        <section className="space-y-3">
          <SectionEyebrow icon={Clock}>Disponibilidad</SectionEyebrow>
          <FieldInput
            name="availabilitySchedule"
            label="Disponibilidad"
            defaultValue={contact.availabilitySchedule ?? ""}
            placeholder="p. ej. L–V 9:00–18:00"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--color-text-primary)]">Disponible 24h</span>
            <Switch
              checked={emergencyAvailable}
              onChange={setEmergencyAvailable}
              ariaLabel="Disponible 24h"
            />
          </div>
        </section>

        {/* Detalles */}
        <section className="space-y-3">
          <SectionEyebrow icon={ContactIcon}>Detalles</SectionEyebrow>
          <div>
            <p className="mb-1.5 text-sm font-medium text-[var(--color-text-primary)]">Tipo de entidad</p>
            <div className="flex flex-wrap gap-2">
              {ENTITY_TYPE_LABELS.map((opt) => (
                <ToggleChip
                  key={opt.id}
                  active={entityType === opt.id}
                  hideCheck
                  onToggle={() => setEntityType(opt.id)}
                >
                  {opt.label}
                </ToggleChip>
              ))}
            </div>
            {entityType !== "person" && (
              <div className="mt-3 border-l-2 border-[var(--color-border-default)] pl-4">
                <FieldInput
                  name="contactPersonName"
                  label="Persona de contacto"
                  defaultValue={contact.contactPersonName ?? ""}
                  placeholder="A quién llamar si es una empresa"
                />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--color-text-primary)]">Tiene acceso a la propiedad</span>
            <Switch
              checked={hasPropertyAccess}
              onChange={setHasPropertyAccess}
              ariaLabel="Tiene acceso a la propiedad"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--color-text-primary)]">Contacto principal</span>
            <Switch
              checked={isPrimary}
              onChange={setIsPrimary}
              ariaLabel="Contacto principal"
            />
          </div>
        </section>

        {/* Visibilidad y notas */}
        <section className="space-y-3">
          <SectionEyebrow icon={Eye}>Visibilidad y notas</SectionEyebrow>
          <div>
            <p className="mb-1.5 text-sm font-medium text-[var(--color-text-primary)]">Visibilidad</p>
            <div className="flex flex-wrap gap-2">
              {VISIBILITY_LABELS.map((opt) => (
                <ToggleChip
                  key={opt.id}
                  active={visibility === opt.id}
                  hideCheck
                  onToggle={() => setVisibility(opt.id)}
                >
                  {opt.label}
                </ToggleChip>
              ))}
            </div>
          </div>
          <FieldTextarea
            name="guestVisibleNotes"
            label="Notas para el huésped"
            rows={2}
            defaultValue={contact.guestVisibleNotes ?? ""}
            placeholder="Información visible para el huésped…"
          />
          <div>
            <button
              type="button"
              onClick={() => setShowInternalNotes((v) => !v)}
              className="flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={cn("-rotate-90 transition-transform duration-150", showInternalNotes && "rotate-0")}
              />
              Notas internas
              {internalNotes && (
                <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
              )}
            </button>
            {showInternalNotes ? (
              <textarea
                name="internalNotes"
                rows={2}
                aria-label="Notas internas"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Información privada (tarifas, contrato…)"
                className={cn(fieldControlClass, "mt-2")}
              />
            ) : (
              <input type="hidden" name="internalNotes" value={internalNotes} />
            )}
          </div>
        </section>
      </form>

      {/* Footer — autosave status (left) + delete (right), OUTSIDE the form. */}
      <div className="flex items-center justify-between border-t border-[var(--color-border-default)] pt-4">
        <div className="flex items-center gap-3">
          <AutoSaveStatus pending={detailsPending || renamePending} />
          {detailsState?.error && (
            <span className="text-xs text-[var(--color-status-error-text)]">{detailsState.error}</span>
          )}
        </div>
        <DeleteConfirmationButton
          title="Eliminar contacto"
          triggerLabel="Eliminar contacto"
          description={deleteDescription}
          entityId={contact.id}
          fieldName="contactId"
          action={deleteContactAction as (prev: { success: boolean } | null, formData: FormData) => Promise<{ success: boolean }>}
        />
      </div>
    </div>
  );

  return (
    <EntityMediaCard
      role={role}
      compact
      viewTransitionName={`contact-card-${contact.id}`}
      titleId={titleId}
      bodyId={bodyId}
      icon={TypeIcon}
      title={contact.displayName}
      titleNode={
        role === "active" ? (
          <InlineEditText
            value={contact.displayName}
            onCommit={handleRename}
            placeholder="Nombre del contacto"
            ariaLabel="Nombre del contacto"
            textClassName="text-[16px] font-semibold leading-tight text-[var(--color-text-primary)]"
            withTooltip
          />
        ) : undefined
      }
      subtitle={role === "active" ? `${typeLabel}${detailSuffix}` : undefined}
      status={<EntityCardStatusPill status={status} label={STATUS_LABEL[status]} detail={statusDetail} />}
      collapsedContent={collapsedContent}
      hoverOverlay={hoverOverlay}
      onExpand={onExpand}
      onCollapse={handleCollapse}
      className={isEmergency && role === "idle" ? "border-[var(--color-status-error-border)]" : undefined}
    >
      {editor}
    </EntityMediaCard>
  );
}
