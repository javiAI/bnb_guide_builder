"use client";

import { useActionState } from "react";
import { createMessageTemplateAction } from "@/lib/actions/messaging.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { automationChannels } from "@/lib/taxonomies/automation-channels";
import { getItems } from "@/lib/taxonomies/_helpers";
import { MessageBodyEditor } from "./message-body-editor";

const channels = getItems(automationChannels);

interface CreateTemplateFormProps {
  propertyId: string;
  touchpointKey: string;
}

export function CreateTemplateForm({ propertyId, touchpointKey }: CreateTemplateFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createMessageTemplateAction,
    null,
  );

  const fieldError = (field: string) =>
    state?.fieldErrors?.[field]?.[0];

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="touchpointKey" value={touchpointKey} />

      {state?.error && (
        <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Canal</span>
          <select name="channelKey" defaultValue="" className={inputClass}>
            <option value="">— Por defecto —</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Asunto (opcional)</span>
          <input name="subjectLine" type="text" placeholder="Ej: Bienvenido a tu alojamiento" className={inputClass} />
          {fieldError("subjectLine") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("subjectLine")}</p>
          )}
        </label>

        <div className="sm:col-span-2">
          <MessageBodyEditor
            propertyId={propertyId}
            name="bodyMd"
            required
            placeholder={"Hola {{guest_name}}, bienvenido a {{property_name}}..."}
            fieldError={fieldError("bodyMd")}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Añadiendo…" : "Añadir plantilla"}
      </button>
    </form>
  );
}
