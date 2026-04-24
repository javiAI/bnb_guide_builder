"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import type {
  AmenitiesDiff,
  CustomsDiffEntry,
  DiffEntry,
  FreeTextDiffEntry,
  ImportDiff,
  ImportPreviewResult,
  ImportWarning,
  UnactionableDiffEntry,
} from "@/lib/imports/booking";

/**
 * Preview-only UI (Rama 14E). Host pastes a Booking listing JSON, we POST to
 * `/api/properties/[propertyId]/import/booking/preview`, and render the diff +
 * warnings. NO apply button — the reconciler output is diagnostic only.
 */
interface Props {
  propertyId: string;
}

type ViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; result: ImportPreviewResult }
  | { kind: "error"; code: string; message: string; issues?: string[] };

export function BookingImportPreview({ propertyId }: Props) {
  const [raw, setRaw] = useState("");
  const [state, setState] = useState<ViewState>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: "loading" });

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        setState({
          kind: "error",
          code: "INVALID_JSON",
          message:
            err instanceof Error ? err.message : "Invalid JSON in textarea.",
        });
        return;
      }

      let res: Response;
      try {
        res = await fetch(
          `/api/properties/${propertyId}/import/booking/preview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed),
          },
        );
      } catch (err) {
        setState({
          kind: "error",
          code: "NETWORK_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Network error — check your connection and try again.",
        });
        return;
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch (err) {
        setState({
          kind: "error",
          code: "RESPONSE_PARSE_ERROR",
          message:
            "Server returned invalid JSON — the endpoint may be down or misconfigured.",
        });
        return;
      }

      if (!res.ok) {
        const errorData = data as {
          error?: { code: string; message: string; issues?: string[] };
        };
        setState({
          kind: "error",
          code: errorData.error?.code ?? "UNKNOWN_ERROR",
          message:
            errorData.error?.message ?? "An unexpected error occurred.",
          issues: errorData.error?.issues,
        });
        return;
      }

      setState({ kind: "result", result: data as ImportPreviewResult });
    } catch (err) {
      console.error("Unexpected error in booking import preview", err);
      setState({
        kind: "error",
        code: "UNKNOWN_ERROR",
        message: "An unexpected error occurred.",
      });
    }
  }

  return (
    <div className="mt-10">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        Import desde Booking (preview)
      </h2>
      <p className="mt-2 text-xs text-[var(--color-neutral-500)]">
        Pega un listing JSON de Booking. Mostramos qué cambiaría sin tocar la
        base de datos — esta vista es solo de diagnóstico.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <textarea
          aria-label="Booking listing JSON"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder='{"property_type_category": "1", "max_occupancy": 4, ... }'
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-neutral-300)] bg-[var(--surface-elevated)] p-3 font-mono text-xs text-[var(--foreground)] focus:border-[var(--color-primary-500)] focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={state.kind === "loading" || raw.trim().length === 0}
            className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {state.kind === "loading" ? "Procesando..." : "Previsualizar"}
          </button>
          <span className="text-xs text-[var(--color-neutral-400)]">
            Nunca se escribe nada en la base de datos desde esta vista.
          </span>
        </div>
      </form>

      {state.kind === "error" && (
        <div className="mt-6 space-y-2">
          <Banner type="danger" message={`[${state.code}] ${state.message}`} />
          {state.issues && state.issues.length > 0 && (
            <ul className="ml-4 list-disc space-y-1 text-xs text-[var(--color-danger-700)]">
              {state.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.kind === "result" && (
        <PreviewResult result={state.result} />
      )}
    </div>
  );
}

function PreviewResult({ result }: { result: ImportPreviewResult }) {
  const { diff, warnings } = result;
  return (
    <div className="mt-6 space-y-6">
      {warnings.length > 0 && <WarningsList warnings={warnings} />}
      <ScalarSection title="Campos de propiedad" entries={diff.scalar} />
      <ScalarSection title="Políticas" entries={diff.policies} />
      <PresenceSection entries={diff.presence} />
      <AmenitiesSection amenities={diff.amenities} />
      <FreeTextSection entries={diff.freeText} />
      <CustomsSection entries={diff.customs} />
      <MetaLine meta={diff.meta} />
    </div>
  );
}

function WarningsList({ warnings }: { warnings: ReadonlyArray<ImportWarning> }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">
        Avisos ({warnings.length})
      </h3>
      <ul className="space-y-2">
        {warnings.map((w, i) => (
          <li key={`${w.code}-${w.field ?? i}`}>
            <Banner
              type="warning"
              message={`[${w.code}${w.field ? ` · ${w.field}` : ""}] ${w.message}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScalarSection({
  title,
  entries,
}: {
  title: string;
  entries: ReadonlyArray<DiffEntry>;
}) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">
        {title} ({entries.length})
      </h3>
      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-neutral-500)]">
            <th className="py-1 pr-3 font-medium">Campo</th>
            <th className="py-1 pr-3 font-medium">Estado</th>
            <th className="py-1 pr-3 font-medium">Actual (DB)</th>
            <th className="py-1 pr-3 font-medium">Entrante</th>
            <th className="py-1 pr-3 font-medium">Motivo / Sugerencia</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.field}
              className="border-t border-[var(--color-neutral-200)]"
            >
              <td className="py-2 pr-3 font-mono text-[11px]">{entry.field}</td>
              <td className="py-2 pr-3">
                <StatusBadge entry={entry} />
              </td>
              <td className="py-2 pr-3 text-[var(--color-neutral-600)]">
                {entry.status === "unactionable" ? "—" : formatValue(entry.current)}
              </td>
              <td className="py-2 pr-3 text-[var(--color-neutral-700)]">
                {formatValue(entry.incoming)}
              </td>
              <td className="py-2 pr-3 text-[var(--color-neutral-500)]">
                {entry.status === "unactionable"
                  ? `${entry.reason}: ${entry.message}`
                  : `suggested: ${entry.suggestedAction}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PresenceSection({
  entries,
}: {
  entries: ReadonlyArray<UnactionableDiffEntry>;
}) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">
        Señales de presencia ({entries.length})
      </h3>
      <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
        Booleanos que el payload trae pero no pueden crear entidades (Spaces,
        amenity instances). Solo informativos.
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {entries.map((entry) => (
          <li key={entry.field} className="font-mono text-[11px]">
            <span className="text-[var(--color-neutral-700)]">{entry.field}</span>
            {"  "}
            <Badge label={entry.reason} tone="neutral" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AmenitiesSection({ amenities }: { amenities: AmenitiesDiff }) {
  const { add, remove, identicalCount } = amenities;
  if (add.length === 0 && remove.length === 0 && identicalCount === 0) {
    return null;
  }
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">
        Amenities
      </h3>
      <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
        <div>
          <p className="font-medium text-[var(--color-success-700)]">
            Añadir ({add.length})
          </p>
          <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-[var(--color-neutral-700)]">
            {add.map((a) => (
              <li key={a.taxonomyId}>{a.taxonomyId}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-[var(--color-danger-700)]">
            Quitar ({remove.length})
          </p>
          <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-[var(--color-neutral-700)]">
            {remove.map((r) => (
              <li key={r.taxonomyId}>{r.taxonomyId}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-[var(--color-neutral-600)]">
            Idénticos
          </p>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-neutral-700)]">
            {identicalCount}
          </p>
        </div>
      </div>
    </section>
  );
}

function FreeTextSection({
  entries,
}: {
  entries: ReadonlyArray<FreeTextDiffEntry>;
}) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">
        Texto libre ({entries.length})
      </h3>
      <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
        Nunca se reconcilia campo a campo. Solo se muestra lado a lado.
      </p>
      <ul className="mt-2 space-y-3">
        {entries.map((entry) => (
          <li key={entry.field} className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] p-3 text-xs">
            <p className="font-mono text-[11px] text-[var(--color-neutral-500)]">
              {entry.field}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase text-[var(--color-neutral-400)]">
                  Actual
                </p>
                <pre className="mt-1 whitespace-pre-wrap text-[11px] text-[var(--color-neutral-600)]">
                  {entry.current ?? "—"}
                </pre>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--color-neutral-400)]">
                  Entrante
                </p>
                <pre className="mt-1 whitespace-pre-wrap text-[11px] text-[var(--color-neutral-700)]">
                  {entry.incoming ?? "—"}
                </pre>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CustomsSection({
  entries,
}: {
  entries: ReadonlyArray<CustomsDiffEntry>;
}) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">
        Sugerencias de valor personalizado ({entries.length})
      </h3>
      <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
        external_ids sin match en taxonomía interna. Nunca se resuelven
        silenciosamente.
      </p>
      <ul className="mt-2 space-y-2">
        {entries.map((entry) => (
          <li
            key={`${entry.field}-${entry.sourceExternalId}`}
            className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] p-3 text-xs"
          >
            <p className="font-mono text-[11px] text-[var(--color-neutral-500)]">
              {entry.field} · {entry.sourceExternalId}
            </p>
            <p className="mt-1 text-[var(--color-neutral-700)]">
              Sugerencia: <strong>{entry.suggestedCustomLabel}</strong>
            </p>
            <p className="mt-0.5 text-[var(--color-neutral-500)]">
              {entry.reason}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({ entry }: { entry: DiffEntry }) {
  if (entry.status === "unactionable") {
    return <Badge label="unactionable" tone="warning" />;
  }
  if (entry.status === "fresh") return <Badge label="fresh" tone="success" />;
  if (entry.status === "identical")
    return <Badge label="identical" tone="neutral" />;
  return <Badge label="conflict" tone="danger" />;
}

function MetaLine({ meta }: { meta: ImportDiff["meta"] }) {
  return (
    <p className="text-[11px] text-[var(--color-neutral-400)]">
      {meta.payloadShape} · generado {meta.generatedAt}
      {meta.incomingLocale && meta.incomingLocale !== meta.currentLocale
        ? ` · locale ${meta.incomingLocale} (DB: ${meta.currentLocale})`
        : ""}
    </p>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
