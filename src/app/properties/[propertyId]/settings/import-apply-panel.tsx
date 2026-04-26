"use client";

import { useMemo, useState } from "react";

import { Banner } from "@/components/ui/banner";
import {
  defaultResolutionForAmenityAdd,
  defaultResolutionForAmenityRemove,
  defaultResolutionForEntry,
  type AppliedMutation,
  type DiffEntry,
  type ImportPreviewResult,
  type ImportWarning,
  type ResolutionStrategy,
  type SkippedMutation,
} from "@/lib/imports/airbnb";
import { formatValue } from "./import-format";

type ApplySuccess = {
  result: "success";
  payloadFingerprint: string;
  applied: AppliedMutation[];
  skipped: SkippedMutation[];
  warnings: ImportWarning[];
};
type ApplyNoop = { result: "noop"; payloadFingerprint: string };

type ApplyState =
  | { kind: "idle" }
  | { kind: "applying" }
  | { kind: "done"; payload: ApplySuccess | ApplyNoop }
  | {
      kind: "stale";
      diff: ImportPreviewResult["diff"];
      missingFields: string[];
    }
  | { kind: "error"; code: string; message: string };

interface Props {
  endpoint: string;
  preview: ImportPreviewResult;
  payload: unknown;
}

export function ImportApplyPanel({ endpoint, preview, payload }: Props) {
  const actionableEntries = useMemo(() => collectActionable(preview), [preview]);
  const [resolutions, setResolutions] = useState<
    Record<string, ResolutionStrategy>
  >(() =>
    Object.fromEntries(actionableEntries.map((e) => [e.field, e.defaultStrategy])),
  );
  const [state, setState] = useState<ApplyState>({ kind: "idle" });

  function setStrategy(field: string, strategy: ResolutionStrategy) {
    setResolutions((prev) => ({ ...prev, [field]: strategy }));
  }

  async function onApply() {
    setState({ kind: "applying" });
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, resolutions }),
      });
    } catch (err) {
      setState({
        kind: "error",
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error",
      });
      return;
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      setState({
        kind: "error",
        code: "RESPONSE_PARSE_ERROR",
        message: "Server returned invalid JSON.",
      });
      return;
    }

    if (res.status === 409) {
      const errBody = data as {
        error?: {
          diff?: ImportPreviewResult["diff"];
          missingFields?: string[];
        };
      };
      setState({
        kind: "stale",
        diff:
          errBody.error?.diff ?? preview.diff,
        missingFields: errBody.error?.missingFields ?? [],
      });
      return;
    }
    if (!res.ok) {
      const errBody = data as { error?: { code?: string; message?: string } };
      setState({
        kind: "error",
        code: errBody.error?.code ?? `HTTP_${res.status}`,
        message: errBody.error?.message ?? "Apply failed.",
      });
      return;
    }
    const okBody = data as { data: ApplySuccess | ApplyNoop };
    setState({ kind: "done", payload: okBody.data });
  }

  return (
    <section className="mt-6 space-y-4 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] p-4">
      <header>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Aplicar cambios
        </h3>
        <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
          Elige por campo qué hacer. Los campos no listados (texto libre,
          señales de presencia, sugerencias custom) nunca se aplican
          automáticamente.
        </p>
      </header>

      {actionableEntries.length === 0 ? (
        <p className="text-xs text-[var(--color-neutral-500)]">
          Nada accionable en este diff.
        </p>
      ) : (
        <ul className="space-y-2">
          {actionableEntries.map((entry) => (
            <li
              key={entry.field}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-neutral-100)] bg-[var(--surface-elevated)] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] text-[var(--color-neutral-700)]">
                  {entry.field}
                </p>
                <p className="text-[11px] text-[var(--color-neutral-500)]">
                  {entry.summary}
                </p>
              </div>
              <StrategyPicker
                field={entry.field}
                value={resolutions[entry.field] ?? entry.defaultStrategy}
                onChange={(s) => setStrategy(entry.field, s)}
                disabled={state.kind === "applying"}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onApply}
          disabled={
            state.kind === "applying" || state.kind === "done"
          }
          className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {state.kind === "applying" ? "Aplicando..." : "Aplicar"}
        </button>
        <span className="text-[11px] text-[var(--color-neutral-400)]">
          Una sola transacción atómica · audit log emitido tras commit.
        </span>
      </div>

      {state.kind === "done" && state.payload.result === "success" && (
        <ApplySuccessBanner payload={state.payload} />
      )}
      {state.kind === "done" && state.payload.result === "noop" && (
        <Banner
          type="info"
          message={`Sin cambios: ya se aplicó este payload anteriormente (fingerprint ${state.payload.payloadFingerprint}).`}
        />
      )}
      {state.kind === "stale" && (
        <Banner
          type="warning"
          message={`El estado cambió desde el preview (${state.missingFields.join(", ")} ya no aparece). Vuelve a ejecutar el preview antes de reintentar.`}
        />
      )}
      {state.kind === "error" && (
        <Banner type="danger" message={`[${state.code}] ${state.message}`} />
      )}
    </section>
  );
}

function ApplySuccessBanner({ payload }: { payload: ApplySuccess }) {
  return (
    <div className="space-y-2">
      <Banner
        type="info"
        message={`Aplicados ${payload.applied.length} cambios; saltados ${payload.skipped.length}. Fingerprint ${payload.payloadFingerprint}.`}
      />
      {payload.warnings.length > 0 && (
        <ul className="ml-4 list-disc space-y-1 text-[11px] text-[var(--color-neutral-600)]">
          {payload.warnings.map((w, i) => (
            <li key={`${w.code}-${w.field ?? i}`}>
              {w.code}
              {w.field ? ` · ${w.field}` : ""}: {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StrategyPicker({
  field,
  value,
  onChange,
  disabled,
}: {
  field: string;
  value: ResolutionStrategy;
  onChange: (s: ResolutionStrategy) => void;
  disabled: boolean;
}) {
  const options: ResolutionStrategy[] = ["take_import", "keep_current", "skip"];
  return (
    <div role="radiogroup" aria-label={`Resolución para ${field}`} className="flex gap-1 text-[11px]">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <label
            key={opt}
            className={`cursor-pointer rounded-[var(--radius-sm)] border px-2 py-1 transition-colors ${
              selected
                ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                : "border-[var(--color-neutral-200)] text-[var(--color-neutral-600)] hover:border-[var(--color-neutral-400)]"
            } ${disabled ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              type="radio"
              name={`strategy-${field}`}
              value={opt}
              checked={selected}
              onChange={() => onChange(opt)}
              disabled={disabled}
              className="sr-only"
            />
            {STRATEGY_LABELS[opt]}
          </label>
        );
      })}
    </div>
  );
}

const STRATEGY_LABELS: Record<ResolutionStrategy, string> = {
  take_import: "Importar",
  keep_current: "Conservar",
  skip: "Omitir",
};

interface ActionableEntry {
  field: string;
  summary: string;
  defaultStrategy: ResolutionStrategy;
}

function collectActionable(preview: ImportPreviewResult): ActionableEntry[] {
  const out: ActionableEntry[] = [];
  for (const entry of preview.diff.scalar) {
    if (entry.status === "unactionable" || entry.status === "identical") continue;
    out.push({
      field: `scalar.${entry.field}`,
      summary: scalarSummary(entry),
      defaultStrategy: defaultResolutionForEntry(entry),
    });
  }
  for (const entry of preview.diff.policies) {
    if (entry.status === "unactionable" || entry.status === "identical") continue;
    out.push({
      field: entry.field,
      summary: scalarSummary(entry),
      defaultStrategy: defaultResolutionForEntry(entry),
    });
  }
  for (const a of preview.diff.amenities.add) {
    out.push({
      field: `amenities.add.${a.taxonomyId}`,
      summary: `Añadir amenity ${a.taxonomyId}`,
      defaultStrategy: defaultResolutionForAmenityAdd(),
    });
  }
  for (const r of preview.diff.amenities.remove) {
    out.push({
      field: `amenities.remove.${r.taxonomyId}`,
      summary: `Quitar amenity ${r.taxonomyId}`,
      defaultStrategy: defaultResolutionForAmenityRemove(),
    });
  }
  return out;
}

function scalarSummary(entry: DiffEntry): string {
  if (entry.status === "unactionable") return entry.message;
  return `${formatValue(entry.current)} → ${formatValue(entry.incoming)}`;
}

