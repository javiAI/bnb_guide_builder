import { InlineSaveStatus } from "./inline-save-status";

/**
 * Auto-save indicator (Liora 16F.5). Section editors save as you edit, so there
 * is no "Guardar" button and no persistent "Guardado" label — just a quiet
 * "Guardando…" while a save is in flight, and nothing at rest. Reuses
 * `InlineSaveStatus`'s "saving" row (same loader + copy) rather than duplicating
 * it. Pair with `useFormAutoSave`.
 */
export function AutoSaveStatus({ pending }: { pending: boolean }) {
  return pending ? <InlineSaveStatus status="saving" /> : null;
}
