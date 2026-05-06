"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import {
  getEntityMediaAction,
  reorderMediaAction,
  unassignMediaAction,
  setCoverAction,
} from "@/lib/actions/media.actions";
import type { MediaAssignmentWithAsset } from "@/lib/actions/media.actions";
import type { MediaEntityType } from "@/lib/schemas/editor.schema";
import { MediaThumbnail } from "./media-thumbnail";
import type { MediaThumbnailData } from "./media-thumbnail";
import { UploadDropzone } from "./upload-dropzone";

interface EntityGalleryProps {
  propertyId: string;
  entityType: MediaEntityType;
  entityId: string;
  /**
   * Per-subsystem scoping (rama 16E.5):
   *   - `undefined` → no filter (current behavior — every assignment).
   *   - `null` → only assignments with `usageKey IS NULL` (legacy/unscoped).
   *   - `string` → only assignments matching that exact key.
   *
   * When `usageKey !== undefined`, the gallery enters scoped mode and disables
   * reorder + setCover affordances. Reorder operates on the full entity pool
   * and setCover uses `usageKey="cover"` — both are incompatible with
   * subsystem scoping until `reorderMediaAction` and `setCoverAction` accept
   * a usageKey scope. Re-enable in a future branch that refactors them.
   */
  usageKey?: string | null;
  /** Label shown above the gallery. If omitted, no header is rendered. */
  label?: string;
  /** Start collapsed (default false). */
  defaultCollapsed?: boolean;
  /** Use compact dropzone layout. */
  compact?: boolean;
  /**
   * When true (and the gallery is in scoped mode for `usageKey === null`),
   * suppresses the upload dropzone — uploads to the "Sin clasificar" bucket
   * are not meaningful (a new upload would not be tagged anywhere). Only
   * delete is allowed for legacy unscoped photos.
   */
  uploadDisabled?: boolean;
}

type AssignmentWithUrl = MediaAssignmentWithAsset & { downloadUrl: string | null };

function toThumbnailData(a: AssignmentWithUrl): MediaThumbnailData {
  return {
    assignmentId: a.id,
    assetId: a.mediaAsset.id,
    mimeType: a.mediaAsset.mimeType,
    mediaType: a.mediaAsset.mediaType,
    caption: a.mediaAsset.caption,
    blurhash: a.mediaAsset.blurhash,
    status: a.mediaAsset.status,
    usageKey: a.usageKey,
    downloadUrl: a.downloadUrl,
  };
}

export function EntityGallery({
  propertyId,
  entityType,
  entityId,
  usageKey,
  label,
  defaultCollapsed = false,
  compact = false,
  uploadDisabled = false,
}: EntityGalleryProps) {
  const isScoped = usageKey !== undefined;
  const [assignments, setAssignments] = useState<AssignmentWithUrl[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isLoading, setIsLoading] = useState(true);
  const [, startTransition] = useTransition();
  const dragItemRef = useRef<number | null>(null);

  const loadMedia = useCallback(async () => {
    const result = await getEntityMediaAction(entityType, entityId, usageKey);
    if (result.success && result.data) {
      setAssignments(result.data.assignments);
    }
    setIsLoading(false);
  }, [entityType, entityId, usageKey]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // ── Optimistic mutations ──

  const optimisticRemove = useCallback(
    (assignmentId: string) => {
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      startTransition(async () => {
        const result = await unassignMediaAction(assignmentId);
        if (!result.success) loadMedia(); // rollback on error
      });
    },
    [loadMedia, startTransition],
  );

  const optimisticSetCover = useCallback(
    (assignmentId: string) => {
      setAssignments((prev) =>
        prev.map((a) => ({
          ...a,
          usageKey: a.id === assignmentId ? "cover" : a.usageKey === "cover" ? null : a.usageKey,
        })),
      );
      startTransition(async () => {
        const result = await setCoverAction(assignmentId);
        if (!result.success) loadMedia(); // rollback on error
      });
    },
    [loadMedia, startTransition],
  );

  // ── Drag & drop reorder ──

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragItemRef.current = index;
    e.dataTransfer.setData("text/plain", String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      const fromIndex = dragItemRef.current;
      if (fromIndex === null || fromIndex === targetIndex) return;

      const reordered = [...assignments];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      setAssignments(reordered);

      startTransition(async () => {
        const result = await reorderMediaAction(
          entityType,
          entityId,
          reordered.map((a) => a.id),
        );
        if (!result.success) loadMedia();
      });

      dragItemRef.current = null;
    },
    [assignments, entityType, entityId, loadMedia, startTransition],
  );

  const count = assignments.length;

  if (isLoading) {
    return (
      <div className="py-2 text-xs text-[var(--color-neutral-400)]">
        Cargando media...
      </div>
    );
  }

  const headerContent = label ? (
    <button
      type="button"
      onClick={() => setIsCollapsed(!isCollapsed)}
      className="flex min-h-[44px] w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left text-xs font-semibold text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] transition-colors"
      aria-expanded={!isCollapsed}
    >
      <ChevronDown
        size={12}
        aria-hidden="true"
        className={`transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
      />
      {label} ({count})
    </button>
  ) : null;

  return (
    <div className="space-y-2">
      {headerContent}

      {!isCollapsed && (
        <>
          {/* Thumbnail grid */}
          {count > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {assignments.map((a, index) =>
                isScoped ? (
                  <MediaThumbnail
                    key={a.id}
                    data={toThumbnailData(a)}
                    onRemove={optimisticRemove}
                  />
                ) : (
                  <MediaThumbnail
                    key={a.id}
                    data={toThumbnailData(a)}
                    onRemove={optimisticRemove}
                    onSetCover={optimisticSetCover}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                  />
                ),
              )}
            </div>
          )}

          {/* Upload dropzone — suppressed for "Sin clasificar" (uploadDisabled) */}
          {!uploadDisabled && (
            <UploadDropzone
              propertyId={propertyId}
              entityType={entityType}
              entityId={entityId}
              usageKey={typeof usageKey === "string" ? usageKey : undefined}
              onUploadComplete={loadMedia}
              compact={compact || count > 0}
            />
          )}
        </>
      )}
    </div>
  );
}
