"use client";

import { useActionState, useState, useMemo } from "react";
import { saveArrivalAction, type ActionResult } from "@/lib/actions/editor.actions";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { accessMethods, getItems } from "@/lib/taxonomy-loader";
import { resolveFieldDependencies } from "@/config/schemas/field-dependencies";

const accessOptions: RadioCardOption[] = getItems(accessMethods).map((item) => ({
  id: item.id,
  label: item.label,
  description: item.description,
  recommended: item.recommended,
}));

/** Follow-up field metadata — driven by dynamic_field_rules taxonomy IDs */
const FOLLOW_UP_FIELDS: Record<string, { label: string; hint?: string; placeholder?: string; type?: "text" | "textarea" }> = {
  "lock.brand": { label: "Marca de la cerradura", placeholder: "Ej: Nuki, Yale, August" },
  "lock.model": { label: "Modelo", placeholder: "Ej: Nuki Smart Lock 3.0" },
  "access.credentials.type": { label: "Tipo de credencial", placeholder: "Código PIN, app, llave…" },
  "access.credentials.value": { label: "Valor de la credencial", placeholder: "Se genera por reserva o es fijo", hint: "No incluir secretos aquí — usar sección de secretos" },
  "access.backup_method": { label: "Método de acceso de backup", placeholder: "Ej: lockbox, llave física" },
  "lock.battery_policy": { label: "Política de batería", placeholder: "Ej: Revisión mensual" },
  "lock.wifi_dependency": { label: "Dependencia de WiFi", placeholder: "Requiere WiFi / funciona offline" },
  "lockbox.location_desc": { label: "Ubicación de la caja de llaves", placeholder: "Ej: Junto a la puerta principal, debajo del buzón", type: "textarea" },
  "arrival.media.lockbox": { label: "Foto de la caja de llaves", hint: "Se adjunta desde la mediateca" },
  "staff.hours": { label: "Horario del personal", placeholder: "Ej: 08:00-22:00 o 24/7" },
  "staff.instructions": { label: "Instrucciones para el personal", placeholder: "Ej: Preguntar en recepción por…", type: "textarea" },
  "staff.contact": { label: "Contacto del personal", placeholder: "Teléfono o nombre" },
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

interface ArrivalFormProps {
  propertyId: string;
  defaultValues: {
    checkInStart: string;
    checkInEnd: string;
    checkOutTime: string;
    primaryAccessMethod: string;
    hostContactPhone: string;
    supportContact: string;
  };
}

export function ArrivalForm({ propertyId, defaultValues }: ArrivalFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveArrivalAction,
    null,
  );

  const [accessMethod, setAccessMethod] = useState(defaultValues.primaryAccessMethod);

  // Resolve field dependencies based on selected access method
  const deps = useMemo(
    () =>
      resolveFieldDependencies({
        "arrival.access.method": accessMethod,
      }),
    [accessMethod],
  );

  const fieldError = (field: string) =>
    state?.fieldErrors?.[field]?.[0];

  const saveStatus = pending ? "saving" : state?.success ? "saved" : state?.error ? "error" : undefined;

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="propertyId" value={propertyId} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Horarios
        </h2>
        {saveStatus && <InlineSaveStatus status={saveStatus} />}
      </div>

      {state?.error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      {/* Check-in window */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--foreground)]">
          Ventana de check-in
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Desde *</span>
            <select
              name="checkInStart"
              required
              defaultValue={defaultValues.checkInStart}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {fieldError("checkInStart") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("checkInStart")}</p>
            )}
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Hasta *</span>
            <select
              name="checkInEnd"
              required
              defaultValue={defaultValues.checkInEnd}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {fieldError("checkInEnd") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("checkInEnd")}</p>
            )}
          </label>
        </div>
      </div>

      {/* Check-out */}
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Hora de check-out *
        </span>
        <select
          name="checkOutTime"
          required
          defaultValue={defaultValues.checkOutTime}
          className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {fieldError("checkOutTime") && (
          <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("checkOutTime")}</p>
        )}
      </label>

      {/* Access method */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Método de acceso principal
        </h2>
        <RadioCardGroup
          name="primaryAccessMethod"
          options={accessOptions}
          value={accessMethod}
          onChange={setAccessMethod}
        />
        {fieldError("primaryAccessMethod") && (
          <p className="mt-2 text-sm text-[var(--color-danger-500)]">{fieldError("primaryAccessMethod")}</p>
        )}
      </div>

      {/* Dynamic follow-up fields based on access method */}
      {deps.visibleFields.size > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Detalles del acceso
          </h3>
          <div className="space-y-4">
            {Array.from(deps.visibleFields)
              .filter((f) => !f.startsWith("troubleshooting."))
              .map((fieldId) => {
                const meta = FOLLOW_UP_FIELDS[fieldId];
                if (!meta) return null;
                return (
                  <label key={fieldId} className="block">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {meta.label}
                    </span>
                    {meta.hint && (
                      <span className="mt-0.5 block text-xs text-[var(--color-neutral-500)]">
                        {meta.hint}
                      </span>
                    )}
                    {meta.type === "textarea" ? (
                      <textarea
                        name={fieldId}
                        rows={2}
                        defaultValue={(deps.defaults[fieldId] as string) ?? ""}
                        placeholder={meta.placeholder}
                        className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
                      />
                    ) : (
                      <input
                        name={fieldId}
                        type="text"
                        defaultValue={(deps.defaults[fieldId] as string) ?? ""}
                        placeholder={meta.placeholder}
                        className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
                      />
                    )}
                  </label>
                );
              })}
          </div>
        </div>
      )}

      {/* Contact */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Contacto
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Teléfono de contacto</span>
            <input
              name="hostContactPhone"
              type="tel"
              defaultValue={defaultValues.hostContactPhone}
              placeholder="+34..."
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Contacto de soporte</span>
            <input
              name="supportContact"
              type="text"
              defaultValue={defaultValues.supportContact}
              placeholder="Nombre o equipo"
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
            />
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
