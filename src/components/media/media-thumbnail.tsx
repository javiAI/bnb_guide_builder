"use client";

import { useRef, useState } from "react";
import { getMediaDownloadUrlAction } from "@/lib/actions/media.actions";

export interface MediaThumbnailData {
  assignmentId: string;
  assetId: string;
  mimeType: string;
  mediaType: string;
  caption: string | null;
  blurhash: string | null;
  status: string;
  usageKey: string | null;
  downloadUrl: string | null;
}

interface MediaThumbnailProps {
  data: MediaThumbnailData;
  /** Called when user clicks remove — parent handles the server action. */
  onRemove?: (assignmentId: string) => void;
  /** Called when user clicks set-cover — parent handles the server action. */
  onSetCover?: (assignmentId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function MediaThumbnail({
  data,
  onRemove,
  onSetCover,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
}: MediaThumbnailProps) {
  const [imgSrc, setImgSrc] = useState(data.downloadUrl);
  const [imgError, setImgError] = useState(false);
  const imgRetryRef = useRef(0);

  const isCover = data.usageKey === "cover";
  const isImage = data.mediaType === "image";
  const isReady = data.status === "ready";

  async function handleOpenFullSize() {
    const newTab = window.open("", "_blank", "noopener,noreferrer");
    const result = await getMediaDownloadUrlAction(data.assetId);
    if (result.success && result.data && newTab) {
      newTab.location.href = result.data.url;
    } else {
      newTab?.close();
    }
  }

  return (
    <div
      className={`group relative aspect-square overflow-hidden rounded-[var(--radius-md)] border-2 transition-all ${
        isCover
          ? "border-[var(--color-primary-400)] ring-2 ring-[var(--color-primary-200)]"
          : "border-[var(--border)] hover:border-[var(--color-neutral-400)]"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Image / Placeholder */}
      {isImage && imgSrc && !imgError ? (
        <img
          src={imgSrc}
          alt={data.caption || "Media"}
          className="h-full w-full object-cover"
          onError={() => {
            if (imgRetryRef.current >= 1) {
              setImgError(true);
              return;
            }
            imgRetryRef.current++;
            getMediaDownloadUrlAction(data.assetId).then((r) => {
              if (r.success && r.data) {
                setImgSrc(r.data.url);
              } else {
                setImgError(true);
              }
            });
          }}
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[var(--color-neutral-100)]">
          <span className="text-2xl text-[var(--color-neutral-400)]">
            {data.mediaType === "video" ? "\u25B6" : "\u{1F5BC}"}
          </span>
        </div>
      )}

      {/* Cover badge */}
      {isCover && (
        <div className="absolute left-1 top-1 rounded-full bg-[var(--color-primary-500)] px-2 py-0.5 text-[10px] font-bold text-white">
          Portada
        </div>
      )}

      {/* Status badge for non-ready */}
      {!isReady && (
        <div className="absolute left-1 top-1 rounded-full bg-[var(--color-warning-500)] px-2 py-0.5 text-[10px] font-bold text-white">
          {data.status === "pending" ? "Subiendo..." : data.status}
        </div>
      )}

      {/* Caption */}
      {data.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-4">
          <p className="truncate text-xs text-white">{data.caption}</p>
        </div>
      )}

      {/* Action overlay on hover */}
      {isReady && (
        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
          <button
            type="button"
            onClick={handleOpenFullSize}
            className="rounded-full bg-white/90 p-1.5 text-xs text-[var(--color-neutral-700)] shadow hover:bg-white"
            title="Ver"
            aria-label="Ver imagen completa"
          >
            &#128269;
          </button>
          {!isCover && (
            <button
              type="button"
              onClick={() => onSetCover?.(data.assignmentId)}
              className="rounded-full bg-white/90 p-1.5 text-xs text-[var(--color-primary-600)] shadow hover:bg-white"
              title="Marcar como portada"
              aria-label="Marcar como portada"
            >
              &#9733;
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove?.(data.assignmentId)}
            className="rounded-full bg-white/90 p-1.5 text-xs text-[var(--color-danger-600)] shadow hover:bg-white"
            title="Quitar"
            aria-label="Quitar imagen"
          >
            &#10005;
          </button>
        </div>
      )}
    </div>
  );
}
