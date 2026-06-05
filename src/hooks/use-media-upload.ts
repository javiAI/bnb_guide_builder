"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  assignMediaAction,
  confirmUploadAction,
  deleteMediaAction,
  requestUploadAction,
} from "@/lib/actions/media.actions";
import type { MediaEntityType } from "@/lib/schemas/editor.schema";

interface UseMediaUploadConfig {
  propertyId: string;
  entityType: MediaEntityType;
  usageKey: string;
  /** The entity the asset is assigned to. Defaults to `propertyId` (correct for
   * `property` / `access_method`, whose entity IS the property). For `space` /
   * `amenity_instance` / `system` the entity is the row itself, so pass its id
   * (e.g. the spaceId) — otherwise assignMediaAction validates the wrong id and
   * fails with "La entidad no pertenece a esta propiedad". */
  entityId?: string;
}

/**
 * Shared single-file upload pipeline (request → PUT R2 → confirm → assign →
 * router.refresh). Used by every surface that uploads one file at a time:
 * MediaCarousel's "Añade portada", access MethodRow thumbnails, the cover-
 * upload icon button, and the media lightbox upload buttons.
 *
 * Multi-file with per-job progress lives in `UploadDropzone` — a different
 * shape (multi-file, entityId-based, no router refresh) and not unified here.
 *
 * Pass `null`/`undefined` to render the hook in a disabled state (callbacks
 * become no-ops) — useful when the surface optionally enables uploads.
 */
export function useMediaUpload(config: UseMediaUploadConfig | null | undefined) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Decompose into primitives so callers don't need to memoize `config` —
  // callback identities depend on strings, not the object literal.
  const propertyId = config?.propertyId;
  const entityType = config?.entityType;
  const usageKey = config?.usageKey;
  const entityId = config?.entityId;
  const ready = propertyId !== undefined && entityType !== undefined && usageKey !== undefined;

  const triggerFilePicker = useCallback(() => {
    if (uploading || !ready) return;
    setError(null);
    fileInputRef.current?.click();
  }, [uploading, ready]);

  const onFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !propertyId || !entityType || !usageKey) return;

      setUploading(true);
      setError(null);
      let assetId: string | null = null;
      try {
        const req = await requestUploadAction(propertyId, file.name, file.type);
        if (!req.success || !req.data) {
          setError(req.error ?? "Error al preparar la subida");
          return;
        }
        assetId = req.data.assetId;
        const put = await fetch(req.data.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!put.ok) {
          setError(`Subida falló (${put.status})`);
          deleteMediaAction(assetId).catch(() => {});
          return;
        }
        const confirm = await confirmUploadAction(assetId);
        if (!confirm.success) {
          setError(confirm.error ?? "Error al verificar");
          return;
        }
        const assign = await assignMediaAction(
          assetId,
          entityType,
          entityId ?? propertyId,
          usageKey,
        );
        if (!assign.success) {
          setError(assign.error ?? "Error al asignar");
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
        if (assetId) deleteMediaAction(assetId).catch(() => {});
      } finally {
        setUploading(false);
      }
    },
    [propertyId, entityType, usageKey, entityId, router],
  );

  return {
    fileInputRef,
    uploading,
    error,
    setError,
    triggerFilePicker,
    onFileChange,
  };
}
