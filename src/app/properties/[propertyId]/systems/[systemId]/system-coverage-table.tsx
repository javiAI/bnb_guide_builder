"use client";

import { useTransition, useState } from "react";
import { updateSystemCoverageAction } from "@/lib/actions/editor.actions";

interface Space {
  id: string;
  name: string;
  spaceType: string;
}

interface Props {
  systemId: string;
  propertyId: string;
  spaces: Space[];
  coverageMap: Record<string, string>;
}

const MODE_LABELS: Record<string, string> = {
  inherited: "Heredado",
  override_yes: "Disponible",
  override_no: "No disponible",
};

export function SystemCoverageTable({ systemId, propertyId, spaces, coverageMap }: Props) {
  const [, startTransition] = useTransition();
  const [localMap, setLocalMap] = useState<Record<string, string>>(coverageMap);
  const [error, setError] = useState<string | null>(null);

  function handleChange(spaceId: string, mode: string) {
    const previousMode = localMap[spaceId] ?? "inherited";
    setError(null);
    setLocalMap((prev) => ({ ...prev, [spaceId]: mode }));
    const fd = new FormData();
    fd.append("systemId", systemId);
    fd.append("propertyId", propertyId);
    fd.append("spaceId", spaceId);
    fd.append("mode", mode);
    startTransition(() => {
      void (async () => {
        try {
          const result = await updateSystemCoverageAction(null, fd);
          if (result && "success" in result && result.success === false) {
            setLocalMap((prev) => ({ ...prev, [spaceId]: previousMode }));
            setError("No se pudo guardar la cobertura. Inténtalo de nuevo.");
          }
        } catch {
          setLocalMap((prev) => ({ ...prev, [spaceId]: previousMode }));
          setError("No se pudo guardar la cobertura. Inténtalo de nuevo.");
        }
      })();
    });
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-default)]">
      {error && (
        <div className="border-b border-[var(--color-border-default)] bg-[var(--color-status-error-bg)] px-4 py-2 text-[12px] text-[var(--color-status-error-text)]">
          {error}
        </div>
      )}
      <table className="w-full text-[13px]">
        <thead className="bg-[var(--color-background-muted)]">
          <tr>
            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">
              Espacio
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">
              Cobertura
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {spaces.map((space) => {
            const mode = localMap[space.id] ?? "inherited";
            return (
              <tr key={space.id}>
                <td className="px-4 py-2.5 text-[13px] text-[var(--color-text-primary)]">
                  {space.name}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={mode}
                    onChange={(e) => handleChange(space.id, e.target.value)}
                    aria-label={`Cobertura en ${space.name}`}
                    className="min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-2 text-[13px] text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
                  >
                    {Object.entries(MODE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
