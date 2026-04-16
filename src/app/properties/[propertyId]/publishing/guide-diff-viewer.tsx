"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { GuideDiff, SectionDiff, DiffStatus } from "@/lib/services/guide-diff.service";
import type { BadgeTone } from "@/lib/types";

const STATUS_LABEL: Record<DiffStatus, string> = {
  added: "Nuevo",
  removed: "Eliminado",
  changed: "Modificado",
  unchanged: "Sin cambios",
};

const STATUS_TONE: Record<DiffStatus, BadgeTone> = {
  added: "success",
  removed: "danger",
  changed: "warning",
  unchanged: "neutral",
};

interface GuideDiffViewerProps {
  diff: GuideDiff;
}

export function GuideDiffViewer({ diff }: GuideDiffViewerProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const hasChanges =
    diff.stats.sectionsAdded +
    diff.stats.sectionsRemoved +
    diff.stats.itemsAdded +
    diff.stats.itemsRemoved +
    diff.stats.itemsChanged > 0;

  if (!hasChanges) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-center">
        <p className="text-sm text-[var(--color-neutral-500)]">
          No hay cambios respecto a la versión publicada.
        </p>
      </div>
    );
  }

  const filteredSections = showUnchanged
    ? diff.sections
    : diff.sections.filter((s) => s.status !== "unchanged");

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="flex flex-wrap gap-2">
        {diff.stats.itemsAdded > 0 && (
          <Badge label={`+${diff.stats.itemsAdded} añadidos`} tone="success" />
        )}
        {diff.stats.itemsRemoved > 0 && (
          <Badge label={`-${diff.stats.itemsRemoved} eliminados`} tone="danger" />
        )}
        {diff.stats.itemsChanged > 0 && (
          <Badge label={`~${diff.stats.itemsChanged} modificados`} tone="warning" />
        )}
        <button
          type="button"
          onClick={() => setShowUnchanged(!showUnchanged)}
          className="text-xs text-[var(--color-primary-600)] hover:underline"
        >
          {showUnchanged ? "Ocultar sin cambios" : "Mostrar todo"}
        </button>
      </div>

      {/* Sections */}
      {filteredSections.map((section) => (
        <DiffSectionBlock key={section.id} section={section} showUnchanged={showUnchanged} />
      ))}
    </div>
  );
}

function DiffSectionBlock({
  section,
  showUnchanged,
}: {
  section: SectionDiff;
  showUnchanged: boolean;
}) {
  const items = showUnchanged
    ? section.items
    : section.items.filter((i) => i.status !== "unchanged");

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{section.label}</h3>
        <Badge label={STATUS_LABEL[section.status]} tone={STATUS_TONE[section.status]} />
      </div>

      {section.metadataChanges && section.metadataChanges.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs text-[var(--color-warning-700)]">
          {section.metadataChanges.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start justify-between rounded-[var(--radius-md)] px-3 py-2 text-sm ${
                item.status === "added"
                  ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
                  : item.status === "removed"
                    ? "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
                    : item.status === "changed"
                      ? "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]"
                      : "bg-[var(--color-neutral-50)] text-[var(--color-neutral-600)]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{item.label}</span>
                {item.changes && item.changes.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-xs opacity-80">
                    {item.changes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </div>
              <Badge label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
