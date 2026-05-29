"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createMessageTemplateAction } from "@/lib/actions/messaging.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { automationChannels } from "@/lib/taxonomies/automation-channels";
import { getItems } from "@/lib/taxonomies/_helpers";
import { MessageBodyEditor } from "./message-body-editor";
import { INPUT_CLASS, PRIMARY_BTN } from "./_styles";

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

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5"
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="touchpointKey" value={touchpointKey} />

      {state?.error && (
        <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-status-error-bg)] p-3 text-sm text-[var(--color-status-error-text)]">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Canal</span>
          <select name="channelKey" defaultValue="" className={INPUT_CLASS}>
            <option value="">— Por defecto —</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Asunto (opcional)</span>
          <input name="subjectLine" type="text" placeholder="Ej: Bienvenido a tu alojamiento" className={INPUT_CLASS} />
          {fieldError("subjectLine") && (
            <p className="mt-1 text-xs text-[var(--color-status-error-text)]">{fieldError("subjectLine")}</p>
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

      <button type="submit" disabled={pending} className={`mt-4 ${PRIMARY_BTN}`}>
        <Plus size={15} aria-hidden="true" />
        {pending ? "Añadiendo…" : "Añadir plantilla"}
      </button>
    </form>
  );
}
