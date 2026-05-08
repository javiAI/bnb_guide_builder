"use client";

import { useCallback, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Check, ImagePlus, Loader2, Star } from "lucide-react";
import {
  assignMediaAction,
  confirmUploadAction,
  deleteMediaAction,
  requestUploadAction,
} from "@/lib/actions/media.actions";
import { cn } from "@/lib/cn";

interface MethodRowProps {
  id: string;
  icon: LucideIcon;
  name: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  recommended?: boolean;
  // When true, the row hosts inline name + description inputs while selected.
  // Selecting the row enters this mode; deselecting collapses it.
  isOther?: boolean;
  customLabel?: string;
  customDesc?: string;
  onCustomLabelChange?: (value: string) => void;
  onCustomDescChange?: (value: string) => void;
  // Primary marker — only present when the layer supports the concept
  // (building / unit / parking). Accessibility omits this entirely.
  isPrimary?: boolean;
  onMakePrimary?: () => void;
  // When set AND `selected` is true, an "add photo" affordance appears on
  // hover/focus-within. The uploaded asset is tagged with `usageKey` so the
  // collapsed-card carousel labels it with the method's chip overlay (the
  // taxonomy lookup happens server-side in `page.tsx`).
  mediaUpload?: {
    propertyId: string;
    usageKey: string;
  };
}

const ACCEPTED_PHOTO_TYPES = ".jpg,.jpeg,.png,.webp,.avif,.gif";

export function MethodRow({
  id,
  icon: Icon,
  name,
  description,
  selected,
  onClick,
  recommended,
  isOther,
  customLabel,
  customDesc,
  onCustomLabelChange,
  onCustomDescChange,
  isPrimary,
  onMakePrimary,
  mediaUpload,
}: MethodRowProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const showInline = isOther === true && selected;
  const showStar = onMakePrimary !== undefined && selected;
  const showUpload = mediaUpload !== undefined && selected;

  const handleUploadClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (uploading) return;
      setUploadError(null);
      fileInputRef.current?.click();
    },
    [uploading],
  );

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !mediaUpload) return;

      setUploading(true);
      setUploadError(null);
      let assetId: string | null = null;
      try {
        const req = await requestUploadAction(mediaUpload.propertyId, file.name, file.type);
        if (!req.success || !req.data) {
          setUploadError(req.error ?? "Error al preparar la subida");
          return;
        }
        assetId = req.data.assetId;
        const put = await fetch(req.data.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!put.ok) {
          setUploadError(`Subida falló (${put.status})`);
          deleteMediaAction(assetId).catch(() => {});
          return;
        }
        const confirm = await confirmUploadAction(assetId);
        if (!confirm.success) {
          setUploadError(confirm.error ?? "Error al verificar");
          return;
        }
        const assign = await assignMediaAction(
          assetId,
          "access_method",
          mediaUpload.propertyId,
          mediaUpload.usageKey,
        );
        if (!assign.success) {
          setUploadError(assign.error ?? "Error al asignar");
          return;
        }
        router.refresh();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Error desconocido");
        if (assetId) deleteMediaAction(assetId).catch(() => {});
      } finally {
        setUploading(false);
      }
    },
    [mediaUpload, router],
  );

  // Per-row view-transition-name lets the browser FLIP-animate primary swap
  // reorders. id may contain non-ident chars (e.g. "rm.smart_lock"); CSS
  // <custom-ident> only allows letters/digits/hyphens/underscores so we
  // sanitize. The matching `view-transition-class: method-row` lets us tune
  // timing once via class selector instead of per-id rules. Parent card uses
  // 320ms cubic-bezier and the matching rule in recipes.css makes rows finish
  // at the same instant — no expand desync.
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const rowStyle = {
    viewTransitionName: `method-row-${safeId}`,
    viewTransitionClass: "method-row",
  } as React.CSSProperties;

  return (
    <div
      style={rowStyle}
      className={cn(
        // `method-row` is a NON-Tailwind class, used purely as a CSS hook for
        // the `html.vt-expand .method-row` rule in recipes.css. Without it the
        // expand-only suppression of view-transition-name has no selector to
        // target (Tailwind utilities + view-transition-class can't be matched
        // by descendant selectors against the original DOM).
        "method-row group rounded-[12px] border-[1.5px]",
        "transition-[border-color,background-color] duration-150 ease-out",
        selected
          ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)]"
          : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-border-strong)]",
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          aria-pressed={selected}
          onClick={onClick}
          className={cn(
            "flex min-h-[56px] flex-1 items-start gap-3 rounded-[12px] p-3 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid h-8 w-8 flex-none place-items-center rounded-[8px]",
              selected
                ? "bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)]"
                : "bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]",
            )}
          >
            <Icon size={16} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-[14px] font-semibold leading-tight text-[var(--color-text-primary)]">
                {name}
              </span>
              {isPrimary && (
                <span className="rounded-full bg-[var(--color-action-primary)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-action-primary-fg)]">
                  Principal
                </span>
              )}
              {recommended && !isPrimary && (
                <span className="rounded-full border border-[var(--color-status-success-border)] bg-[var(--color-status-success-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-status-success-text)]">
                  Recomendado
                </span>
              )}
            </span>
            {description && (
              <span className="line-clamp-2 text-[12px] leading-[1.45] text-[var(--color-text-secondary)]">
                {description}
              </span>
            )}
          </span>
          {selected && !showStar && (
            <Check
              size={18}
              aria-hidden="true"
              className="mt-0.5 flex-none text-[var(--color-action-primary)]"
            />
          )}
        </button>
        {showUpload && (
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={uploading}
            aria-label={uploading ? `Subiendo foto a ${name}` : `Añadir foto a ${name}`}
            className={cn(
              "flex min-h-[44px] min-w-[44px] flex-none items-center justify-center rounded-[12px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
              "disabled:cursor-not-allowed",
              uploading
                ? "text-[var(--color-action-primary)]"
                : "text-[var(--color-text-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--color-action-primary)]",
            )}
          >
            {uploading ? (
              <Loader2 size={18} aria-hidden="true" className="animate-spin" />
            ) : (
              <ImagePlus size={18} aria-hidden="true" />
            )}
          </button>
        )}
        {showStar && (
          <button
            type="button"
            onClick={onMakePrimary}
            aria-label={isPrimary ? "Método principal" : "Marcar como principal"}
            aria-pressed={isPrimary === true}
            className={cn(
              "flex min-h-[44px] min-w-[44px] flex-none items-center justify-center rounded-[12px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
              isPrimary
                ? "text-[var(--color-action-primary)]"
                : "text-[var(--color-text-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--color-action-primary)]",
            )}
          >
            <Star
              size={18}
              aria-hidden="true"
              className={isPrimary ? "fill-[var(--color-action-primary)]" : ""}
            />
          </button>
        )}
      </div>
      {showUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_PHOTO_TYPES}
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
      {uploadError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-2 border-t border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-3 py-2 text-[12px] text-[var(--color-status-error-text)]"
        >
          <span className="min-w-0 flex-1 truncate">{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="flex-none text-[11px] font-semibold uppercase tracking-[0.04em] underline-offset-2 hover:underline"
            aria-label="Cerrar error"
          >
            Cerrar
          </button>
        </div>
      )}
      {showInline && (
        <div className="space-y-3 border-t border-[var(--color-action-primary)]/30 px-3 py-3">
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
              Nombre del método *
            </span>
            <input
              type="text"
              value={customLabel ?? ""}
              onChange={(e) => onCustomLabelChange?.(e.target.value)}
              placeholder="Ej. Tarjeta del garaje"
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm focus:border-[var(--color-action-primary)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
              Descripción
            </span>
            <textarea
              rows={2}
              value={customDesc ?? ""}
              onChange={(e) => onCustomDescChange?.(e.target.value)}
              placeholder="Cómo funciona este método de acceso (opcional)"
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm focus:border-[var(--color-action-primary)] focus:outline-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}
