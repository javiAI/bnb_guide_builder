"use client";

import { useActionState } from "react";
import {
  publishGuideVersionAction,
  unpublishVersionAction,
  rollbackToVersionAction,
} from "@/lib/actions/guide.actions";
import type { ActionResult } from "@/lib/types/action-result";

// ──────────────────────────────────────────────
// Publish current live tree
// ──────────────────────────────────────────────

export function PublishButton({ propertyId }: { propertyId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    publishGuideVersionAction,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="propertyId" value={propertyId} />
      {state?.error && (
        <p className="mb-2 text-xs text-[var(--color-danger-500)]">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Publicando..." : "Publicar versión actual"}
      </button>
    </form>
  );
}

// ──────────────────────────────────────────────
// Unpublish
// ──────────────────────────────────────────────

export function UnpublishButton({ versionId }: { versionId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    unpublishVersionAction,
    null,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="versionId" value={versionId} />
      {state?.error && (
        <p className="mb-1 text-xs text-[var(--color-danger-500)]">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] px-3 py-1.5 text-xs font-medium text-[var(--color-danger-600)] transition-colors hover:bg-[var(--color-danger-50)] disabled:opacity-50"
      >
        {pending ? "..." : "Despublicar"}
      </button>
    </form>
  );
}

// ──────────────────────────────────────────────
// Rollback
// ──────────────────────────────────────────────

export function RollbackButton({ sourceVersionId, version }: { sourceVersionId: string; version: number }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    rollbackToVersionAction,
    null,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="sourceVersionId" value={sourceVersionId} />
      {state?.error && (
        <p className="mb-1 text-xs text-[var(--color-danger-500)]">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] border border-[var(--color-primary-200)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-600)] transition-colors hover:bg-[var(--color-primary-50)] disabled:opacity-50"
      >
        {pending ? "..." : `Restaurar v${version}`}
      </button>
    </form>
  );
}
