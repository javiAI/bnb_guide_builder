"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSystemAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";

interface Props {
  systemId: string;
  propertyId: string;
}

export function DeleteSystemButton({ systemId, propertyId }: Props) {
  const router = useRouter();
  const [result, action] = useActionState<ActionResult | null, FormData>(
    deleteSystemAction,
    null,
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (result?.success) {
      router.push(`/properties/${propertyId}/systems`);
    }
  }, [result, router, propertyId]);

  function handleClick() {
    if (!confirm("¿Eliminar este sistema? Se perderá toda la configuración.")) return;
    const fd = new FormData();
    fd.append("systemId", systemId);
    fd.append("propertyId", propertyId);
    startTransition(() => action(fd));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-status-error-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-status-error-icon)] hover:bg-[var(--color-status-error-bg)] disabled:opacity-50 transition-colors"
    >
      {isPending ? "Eliminando…" : "Eliminar sistema"}
    </button>
  );
}
