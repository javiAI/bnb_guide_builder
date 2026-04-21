"use client";

import { useActionState, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  createMessageAutomationAction,
  deleteMessageAutomationAction,
} from "@/lib/actions/messaging.actions";
import { normaliseTriggerType } from "@/lib/schemas/messaging.schema";
import type { ActionResult } from "@/lib/types/action-result";
import {
  automationChannels,
  findMessagingTrigger,
  getItems,
  messagingTriggers,
} from "@/lib/taxonomy-loader";

const channels = getItems(automationChannels);
const triggers = messagingTriggers.items;

interface AutomationData {
  id: string;
  templateId: string;
  channelKey: string;
  triggerType: string;
  sendOffsetMinutes: number;
  active: boolean;
}

interface TemplateRef {
  id: string;
  subjectLine: string | null;
  bodyMd: string;
}

interface AutomationSectionProps {
  automations: AutomationData[];
  templates: TemplateRef[];
  propertyId: string;
  touchpointKey: string;
}

function formatOffset(minutes: number): string {
  if (minutes === 0) return "Al momento";
  const abs = Math.abs(minutes);
  const sign = minutes < 0 ? "antes" : "después";
  if (abs < 60) return `${abs} min ${sign}`;
  const hours = Math.floor(abs / 60);
  const remainMin = abs % 60;
  if (hours < 24) {
    return remainMin > 0
      ? `${hours}h ${remainMin}min ${sign}`
      : `${hours}h ${sign}`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ${sign}`;
}

export function AutomationSection({
  automations,
  templates,
  propertyId,
  touchpointKey,
}: AutomationSectionProps) {
  const [createState, createAction, createPending] = useActionState<ActionResult | null, FormData>(
    createMessageAutomationAction,
    null,
  );

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  const fieldError = (field: string) =>
    createState?.fieldErrors?.[field]?.[0];

  return (
    <div>
      {automations.length === 0 ? (
        <p className="text-xs text-[var(--color-neutral-400)]">
          Sin automatizaciones configuradas.
        </p>
      ) : (
        <div className="space-y-2">
          {automations.map((auto) => {
            const tpl = templates.find((t) => t.id === auto.templateId);
            const channelLabel = channels.find((c) => c.id === auto.channelKey)?.label ?? auto.channelKey;

            return (
              <AutomationRow
                key={auto.id}
                automation={auto}
                templateLabel={tpl?.subjectLine ?? tpl?.bodyMd.slice(0, 40) ?? "—"}
                channelLabel={channelLabel}
                propertyId={propertyId}
              />
            );
          })}
        </div>
      )}

      {templates.length > 0 && (
        <form action={createAction} className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="touchpointKey" value={touchpointKey} />

          {createState?.error && (
            <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
              {createState.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-[var(--color-neutral-500)]">Plantilla *</span>
              <select name="templateId" required className={inputClass}>
                <option value="">— Seleccionar —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.subjectLine ?? t.bodyMd.slice(0, 50)}
                  </option>
                ))}
              </select>
              {fieldError("templateId") && (
                <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("templateId")}</p>
              )}
            </label>

            <label className="block">
              <span className="text-xs text-[var(--color-neutral-500)]">Canal *</span>
              <select name="channelKey" required className={inputClass}>
                <option value="">— Seleccionar —</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.label}</option>
                ))}
              </select>
              {fieldError("channelKey") && (
                <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("channelKey")}</p>
              )}
            </label>

            <TriggerAndOffsetFields inputClass={inputClass} />
          </div>

          <button
            type="submit"
            disabled={createPending}
            className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
          >
            {createPending ? "Creando…" : "Crear automatización"}
          </button>
        </form>
      )}

      {templates.length === 0 && (
        <p className="mt-4 text-xs text-[var(--color-neutral-400)]">
          Crea una plantilla primero para poder añadir automatizaciones.
        </p>
      )}
    </div>
  );
}

function TriggerAndOffsetFields({ inputClass }: { inputClass: string }) {
  const defaultTrigger = triggers[0];
  const [triggerId, setTriggerId] = useState<string>(defaultTrigger.id);
  const [offset, setOffset] = useState<number>(
    defaultTrigger.defaultOffsetMinutes,
  );

  const current = useMemo(
    () => triggers.find((t) => t.id === triggerId) ?? defaultTrigger,
    [triggerId, defaultTrigger],
  );

  return (
    <>
      <label className="block">
        <span className="text-xs text-[var(--color-neutral-500)]">Tipo de trigger</span>
        <select
          name="triggerType"
          value={triggerId}
          onChange={(e) => {
            const next = triggers.find((t) => t.id === e.target.value);
            setTriggerId(e.target.value);
            if (next) setOffset(next.defaultOffsetMinutes);
          }}
          className={inputClass}
        >
          {triggers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
          {current.description}
        </p>
      </label>

      <label className="block">
        <span className="text-xs text-[var(--color-neutral-500)]">Offset</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            name="sendOffsetMinutes"
            type="number"
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
            className={`${inputClass} w-32`}
          />
          <span className="text-xs text-[var(--color-neutral-400)]">minutos</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {current.presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setOffset(preset.offsetMinutes)}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                offset === preset.offsetMinutes
                  ? "bg-[var(--color-primary-500)] text-white"
                  : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </label>
    </>
  );
}

function AutomationRow({
  automation,
  templateLabel,
  channelLabel,
  propertyId,
}: {
  automation: AutomationData;
  templateLabel: string;
  channelLabel: string;
  propertyId: string;
}) {
  const [, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteMessageAutomationAction,
    null,
  );

  return (
    <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--foreground)]">
            {templateLabel}
          </span>
          <Badge label={channelLabel} tone="neutral" />
          <Badge
            label={automation.active ? "Activa" : "Inactiva"}
            tone={automation.active ? "success" : "neutral"}
          />
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-neutral-400)]">
          {findMessagingTrigger(normaliseTriggerType(automation.triggerType) ?? automation.triggerType)?.label ?? automation.triggerType} ·{" "}
          {formatOffset(automation.sendOffsetMinutes)}
        </p>
      </div>
      <form action={deleteAction} className="ml-3 shrink-0">
        <input type="hidden" name="automationId" value={automation.id} />
        <input type="hidden" name="propertyId" value={propertyId} />
        <button
          type="submit"
          disabled={deletePending}
          className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] px-2 py-1 text-xs text-[var(--color-danger-600)] transition-colors hover:bg-[var(--color-danger-50)] disabled:opacity-50"
        >
          {deletePending ? "…" : "×"}
        </button>
      </form>
    </div>
  );
}
