"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-status-error-border)] px-3.5 text-[13px] font-medium text-[var(--color-status-error-text)] transition-colors hover:bg-[var(--color-status-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:opacity-50"
    >
      <Trash2 size={15} aria-hidden="true" />
      {isPending ? "Eliminando…" : "Eliminar sistema"}
    </button>
  );
}
