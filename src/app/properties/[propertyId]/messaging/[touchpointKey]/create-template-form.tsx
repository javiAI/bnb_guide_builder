"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
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

const INPUT_CLASS =
  "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]";

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

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-5 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:opacity-50"
      >
        <Plus size={15} aria-hidden="true" />
        {pending ? "Añadiendo…" : "Añadir plantilla"}
      </button>
    </form>
  );
}
