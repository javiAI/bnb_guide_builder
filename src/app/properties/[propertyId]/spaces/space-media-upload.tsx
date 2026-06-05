"use client";

import { useMemo } from "react";
import { Loader2, Upload } from "lucide-react";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { cn } from "@/lib/cn";

/**
 * Cover upload affordance for a space — add photos OR videos at any time (the
 * MediaCarousel's "Añade portada" only covers the first upload). Reuses the
 * shared single-file pipeline (`useMediaUpload`) with `entityType="space"` and
 * `usageKey="space.<id>"`, the same convention the carousel + lightbox read.
 * Rendered as a hover-revealed overlay icon on the cover (see `className`).
 */
export function SpaceMediaUpload({
  propertyId,
  spaceId,
  className,
}: {
  propertyId: string;
  spaceId: string;
  className?: string;
}) {
  const config = useMemo(
    () => ({ propertyId, entityType: "space" as const, usageKey: `space.${spaceId}` }),
    [propertyId, spaceId],
  );
  const { fileInputRef, uploading, error, triggerFilePicker, onFileChange } = useMediaUpload(config);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={onFileChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); triggerFilePicker(); }}
        disabled={uploading}
        aria-label={
          uploading ? "Subiendo media…" : error ? "Error al subir — reintentar" : "Añadir fotos o vídeos"
        }
        className={cn(
          // Structural only — each call site sets the surface (overlay on the
          // cover, subtle border in the active header) via `className`.
          "recipe-icon-btn-32 grid h-8 w-8 flex-none place-items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-elevated)]",
          "disabled:cursor-not-allowed disabled:opacity-80",
          error && "ring-2 ring-[var(--color-status-error-solid)]",
          className,
        )}
      >
        {uploading ? (
          <Loader2 size={16} aria-hidden="true" className="animate-spin" />
        ) : (
          <Upload size={16} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
