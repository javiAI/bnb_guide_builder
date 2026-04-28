"use client";

import { useActionState } from "react";
import { useState, useEffect, useRef } from "react";
import { Icon } from "./icon";

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
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
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
        className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-action-destructive)] hover:bg-[var(--color-action-destructive-subtle)] transition-colors"
        title={title}
      >
        <Icon name="trash" size="sm" tone="muted" />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-full max-w-sm rounded-xl border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-0 shadow-xl backdrop:bg-black/50"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{description}</p>

          {requireConfirmText && (
            <div className="mt-4">
              <label htmlFor="delete-confirm" className="block text-sm font-medium text-[var(--color-text-primary)]">
                Escribe{" "}
                <strong className="text-[var(--color-action-destructive)]">{requireConfirmText}</strong>{" "}
                para confirmar
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:border-[var(--input-border-error)] focus:outline-none focus:shadow-[var(--input-shadow-error)]"
                placeholder={requireConfirmText}
              />
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-interactive-hover)] transition-colors"
            >
              Cancelar
            </button>
            <form action={formAction}>
              <input type="hidden" name={fieldName} value={entityId} />
              <button
                type="submit"
                disabled={!canDelete || pending}
                className="rounded-lg bg-[var(--button-destructive-bg)] px-4 py-2 text-sm font-medium text-[var(--button-destructive-fg)] hover:bg-[var(--button-destructive-bg-hover)] disabled:cursor-not-allowed disabled:bg-[var(--button-disabled-bg)] disabled:text-[var(--button-disabled-fg)] transition-colors"
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
