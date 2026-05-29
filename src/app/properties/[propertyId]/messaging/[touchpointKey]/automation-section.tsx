"use client";

import { useActionState, useMemo, useState } from "react";
import { Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  createMessageAutomationAction,
  deleteMessageAutomationAction,
} from "@/lib/actions/messaging.actions";
import { normaliseTriggerType } from "@/lib/schemas/messaging.schema";
import type { ActionResult } from "@/lib/types/action-result";
import { automationChannels } from "@/lib/taxonomies/automation-channels";
import {
  findMessagingTrigger,
  messagingTriggers,
} from "@/lib/taxonomies/messaging-triggers";
import { getItems } from "@/lib/taxonomies/_helpers";
import { INPUT_CLASS, PRIMARY_BTN } from "./_styles";

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

  const fieldError = (field: string) =>
    createState?.fieldErrors?.[field]?.[0];

  return (
    <div>
      {automations.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
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
        <form action={createAction} className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="touchpointKey" value={touchpointKey} />

          {createState?.error && (
            <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-status-error-bg)] p-3 text-sm text-[var(--color-status-error-text)]">
              {createState.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Plantilla *</span>
              <select name="templateId" required className={INPUT_CLASS}>
                <option value="">— Seleccionar —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.subjectLine ?? t.bodyMd.slice(0, 50)}
                  </option>
                ))}
              </select>
              {fieldError("templateId") && (
                <p className="mt-1 text-xs text-[var(--color-status-error-text)]">{fieldError("templateId")}</p>
              )}
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Canal *</span>
              <select name="channelKey" required className={INPUT_CLASS}>
                <option value="">— Seleccionar —</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.label}</option>
                ))}
              </select>
              {fieldError("channelKey") && (
                <p className="mt-1 text-xs text-[var(--color-status-error-text)]">{fieldError("channelKey")}</p>
              )}
            </label>

            <TriggerAndOffsetFields inputClass={INPUT_CLASS} />
          </div>

          <button type="submit" disabled={createPending} className={`mt-4 ${PRIMARY_BTN}`}>
            <Zap size={15} aria-hidden="true" />
            {createPending ? "Creando…" : "Crear automatización"}
          </button>
        </form>
      )}

      {templates.length === 0 && (
        <p className="mt-4 text-xs text-[var(--color-text-muted)]">
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
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Tipo de trigger</span>
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
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {current.description}
        </p>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Offset</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            name="sendOffsetMinutes"
            type="number"
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
            className={`${inputClass} w-32`}
          />
          <span className="text-xs text-[var(--color-text-muted)]">minutos</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {current.presets.map((preset) => {
            const active = offset === preset.offsetMinutes;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setOffset(preset.offsetMinutes)}
                aria-pressed={active}
                className={`inline-flex min-h-[44px] items-center rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] ${
                  active
                    ? "bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)]"
                    : "bg-[var(--color-background-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-interactive-hover)]"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
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
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {templateLabel}
          </span>
          <Badge label={channelLabel} tone="neutral" />
          <Badge
            label={automation.active ? "Activa" : "Inactiva"}
            tone={automation.active ? "success" : "neutral"}
          />
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {findMessagingTrigger(normaliseTriggerType(automation.triggerType) ?? automation.triggerType)?.label ?? automation.triggerType} ·{" "}
          {formatOffset(automation.sendOffsetMinutes)}
        </p>
      </div>
      <form action={deleteAction} className="shrink-0">
        <input type="hidden" name="automationId" value={automation.id} />
        <input type="hidden" name="propertyId" value={propertyId} />
        <button
          type="submit"
          disabled={deletePending}
          aria-label="Eliminar automatización"
          className="recipe-icon-btn-32 grid h-8 w-8 place-items-center rounded-[10px] text-[var(--color-status-error-text)] transition-colors hover:bg-[var(--color-status-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:opacity-50"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
