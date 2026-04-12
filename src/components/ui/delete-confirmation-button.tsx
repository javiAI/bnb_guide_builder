"use client";

import { useActionState } from "react";
import { useState, useEffect, useRef } from "react";

interface DeleteConfirmationButtonProps {
  title: string;
  description: string;
  entityId: string;
  fieldName: string;
  action: (prev: { success: boolean } | null, formData: FormData) => Promise<{ success: boolean }>;
  requireConfirmText?: string;
}

export function DeleteConfirmationButton({
  title,
  description,
  entityId,
  fieldName,
  action,
  requireConfirmText,
}: DeleteConfirmationButtonProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [, formAction, pending] = useActionState<{ success: boolean } | null, FormData>(action, null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal?.();
    } else {
      dialog.close?.();
      setConfirmation("");
    }
  }, [open]);

  const canDelete = requireConfirmText
    ? confirmation.toLowerCase() === requireConfirmText.toLowerCase()
    : true;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="rounded-md p-1.5 text-[var(--color-neutral-400)] hover:text-red-600 hover:bg-red-50 transition-colors"
        title={title}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-0 shadow-xl backdrop:bg-black/50"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="mt-2 text-sm text-[var(--color-neutral-600)]">{description}</p>

          {requireConfirmText && (
            <div className="mt-4">
              <label htmlFor="delete-confirm" className="block text-sm font-medium text-[var(--color-neutral-700)]">
                Escribe <strong className="text-red-600">{requireConfirmText}</strong> para confirmar
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder={requireConfirmText}
              />
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] transition-colors"
            >
              Cancelar
            </button>
            <form action={formAction}>
              <input type="hidden" name={fieldName} value={entityId} />
              <button
                type="submit"
                disabled={!canDelete || pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                {pending ? "Eliminando..." : "Eliminar"}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
