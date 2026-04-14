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
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
      {error && (
        <div className="border-b border-[var(--border)] bg-[var(--color-error-50)] px-4 py-2 text-xs text-[var(--color-error-700)]">
          {error}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-neutral-50)]">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-neutral-500)]">Espacio</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-neutral-500)]">Cobertura</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {spaces.map((space) => {
            const mode = localMap[space.id] ?? "inherited";
            return (
              <tr key={space.id}>
                <td className="px-4 py-2.5 text-sm text-[var(--foreground)]">{space.name}</td>
                <td className="px-4 py-2.5">
                  <select
                    value={mode}
                    onChange={(e) => handleChange(space.id, e.target.value)}
                    className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
                  >
                    {Object.entries(MODE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
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
