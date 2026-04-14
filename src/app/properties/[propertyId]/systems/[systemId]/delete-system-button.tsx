"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { deleteSystemAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/actions/editor.actions";
import { useEffect } from "react";

interface Props {
  systemId: string;
  propertyId: string;
}

export function DeleteSystemButton({ systemId, propertyId }: Props) {
  const router = useRouter();
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    deleteSystemAction,
    null,
  );

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
    action(fd);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-[var(--radius-md)] border border-[var(--color-error-300)] px-3 py-1.5 text-xs font-medium text-[var(--color-error-600)] hover:bg-[var(--color-error-50)] disabled:opacity-50 transition-colors"
    >
      {pending ? "Eliminando…" : "Eliminar sistema"}
    </button>
  );
}
