"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  publishGuideVersionAction,
  createGuideSectionItemAction,
  deleteGuideSectionItemAction,
  type ActionResult,
} from "@/lib/actions/knowledge.actions";
import { VISIBILITY_LABEL, normaliseVisibility } from "@/lib/visibility";

interface SectionItemData {
  id: string;
  contentMd: string;
  visibility: string;
  sortOrder: number;
}

interface SectionData {
  id: string;
  sectionKey: string;
  title: string;
  sortOrder: number;
  items: SectionItemData[];
}

interface VersionData {
  id: string;
  version: number;
  status: string;
  sections: SectionData[];
}

interface GuideVersionDetailProps {
  version: VersionData;
  propertyId: string;
}

export function GuideVersionDetail({ version, propertyId }: GuideVersionDetailProps) {
  const [publishState, publishAction, publishPending] = useActionState<ActionResult | null, FormData>(
    publishGuideVersionAction,
    null,
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Versión {version.version}
          </h2>
          <Badge label="Borrador" tone="warning" />
        </div>
        <form action={publishAction}>
          <input type="hidden" name="versionId" value={version.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          {publishState?.error && (
            <p className="mb-2 text-xs text-[var(--color-danger-500)]">{publishState.error}</p>
          )}
          <button
            type="submit"
            disabled={publishPending}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-success-600)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-success-700)] disabled:opacity-50"
          >
            {publishPending ? "Publicando…" : "Publicar versión"}
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-6">
        {version.sections.map((section) => (
          <GuideSectionBlock
            key={section.id}
            section={section}
            propertyId={propertyId}
          />
        ))}
      </div>
    </div>
  );
}

function GuideSectionBlock({
  section,
  propertyId,
}: {
  section: SectionData;
  propertyId: string;
}) {
  const [addState, addAction, addPending] = useActionState<ActionResult | null, FormData>(
    createGuideSectionItemAction,
    null,
  );

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  const fieldError = (field: string) =>
    addState?.fieldErrors?.[field]?.[0];

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        {section.title}
      </h3>
      <p className="mt-0.5 text-xs text-[var(--color-neutral-400)]">
        {section.sectionKey}
      </p>

      {section.items.length > 0 ? (
        <div className="mt-4 space-y-2">
          {section.items.map((item) => (
            <SectionItemRow
              key={item.id}
              item={item}
              propertyId={propertyId}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-[var(--color-neutral-400)]">
          Sin contenido en esta sección.
        </p>
      )}

      {/* Add item form */}
      <form action={addAction} className="mt-4 border-t border-[var(--border)] pt-4">
        <input type="hidden" name="sectionId" value={section.id} />
        <input type="hidden" name="propertyId" value={propertyId} />

        {addState?.error && (
          <p className="mb-2 text-xs text-[var(--color-danger-500)]">{addState.error}</p>
        )}

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Contenido (Markdown)</span>
          <textarea
            name="contentMd"
            required
            rows={2}
            placeholder="Escribe contenido para esta sección..."
            className={inputClass}
          />
          {fieldError("contentMd") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("contentMd")}</p>
          )}
        </label>

        <div className="mt-2 flex items-end gap-3">
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Visibilidad</span>
            <select name="visibility" defaultValue="guest" className={inputClass}>
              <option value="guest">Huésped</option>
              <option value="ai">AI</option>
              <option value="internal">Interno</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={addPending}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
          >
            {addPending ? "…" : "Añadir"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SectionItemRow({
  item,
  propertyId,
}: {
  item: SectionItemData;
  propertyId: string;
}) {
  const [, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteGuideSectionItemAction,
    null,
  );

  return (
    <div className="flex items-start justify-between rounded-[var(--radius-md)] bg-[var(--color-neutral-50)] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--foreground)]">{item.contentMd}</p>
        <span className="mt-1 text-xs text-[var(--color-neutral-400)]">
          {VISIBILITY_LABEL[normaliseVisibility(item.visibility)]}
        </span>
      </div>
      <form action={deleteAction} className="ml-3 shrink-0">
        <input type="hidden" name="itemId" value={item.id} />
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
