"use client";

import { useCallback, useRef, useState } from "react";
import {
  requestUploadAction,
  confirmUploadAction,
  assignMediaAction,
  deleteMediaAction,
} from "@/lib/actions/media.actions";
import type { MediaEntityType } from "@/lib/schemas/editor.schema";

/** Client-safe list — avoids importing the server-only storage service. */
const ACCEPTED_TYPES =
  ".jpg,.jpeg,.png,.webp,.avif,.gif,.mp4";

interface UploadJob {
  id: string;
  fileName: string;
  progress: "requesting" | "uploading" | "confirming" | "assigning" | "error";
  error?: string;
}

interface UploadDropzoneProps {
  propertyId: string;
  entityType: MediaEntityType;
  entityId: string;
  onUploadComplete?: () => void;
  compact?: boolean;
}


export function UploadDropzone({
  propertyId,
  entityType,
  entityId,
  onUploadComplete,
  compact = false,
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateJob = useCallback(
    (id: string, update: Partial<UploadJob>) =>
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...update } : j))),
    [],
  );

  /** Returns true if the file was uploaded and assigned successfully. */
  const processFile = useCallback(
    async (file: File): Promise<boolean> => {
      const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const job: UploadJob = { id: jobId, fileName: file.name, progress: "requesting" };
      setJobs((prev) => [...prev, job]);

      let assetId: string | null = null;

      try {
        // 1. Request presigned upload URL
        const reqResult = await requestUploadAction(propertyId, file.name, file.type);
        if (!reqResult.success || !reqResult.data) {
          updateJob(jobId, { progress: "error", error: reqResult.error });
          return false;
        }

        const { uploadUrl } = reqResult.data;
        assetId = reqResult.data.assetId;

        // 2. Upload file directly to R2
        updateJob(jobId, { progress: "uploading" });
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadResponse.ok) {
          updateJob(jobId, { progress: "error", error: `Upload falló: ${uploadResponse.status}` });
          deleteMediaAction(assetId).catch(() => {});
          return false;
        }

        // 3. Confirm upload (validates in R2, generates blurhash)
        updateJob(jobId, { progress: "confirming" });
        const confirmResult = await confirmUploadAction(assetId);
        if (!confirmResult.success) {
          updateJob(jobId, { progress: "error", error: confirmResult.error });
          return false;
        }

        // 4. Assign to entity
        updateJob(jobId, { progress: "assigning" });
        const assignResult = await assignMediaAction(assetId, entityType, entityId);
        if (!assignResult.success) {
          updateJob(jobId, { progress: "error", error: assignResult.error });
          return false;
        }

        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        return true;
      } catch (err) {
        updateJob(jobId, {
          progress: "error",
          error: err instanceof Error ? err.message : "Error desconocido",
        });
        if (assetId) deleteMediaAction(assetId).catch(() => {});
        return false;
      }
    },
    [propertyId, entityType, entityId, updateJob],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const MAX_CONCURRENT = 3;
      let anySuccess = false;
      for (let i = 0; i < fileArray.length; i += MAX_CONCURRENT) {
        const batch = fileArray.slice(i, i + MAX_CONCURRENT);
        const results = await Promise.all(batch.map((file) => processFile(file)));
        if (results.some(Boolean)) anySuccess = true;
      }
      if (anySuccess) onUploadComplete?.();
    },
    [processFile, onUploadComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = ""; // Reset so same file can be re-selected
      }
    },
    [handleFiles],
  );

  const hasErrors = jobs.some((j) => j.progress === "error");

  // Clear errored jobs
  const clearFinished = () => {
    setJobs((prev) => prev.filter((j) => j.progress !== "error"));
  };

  return (
    <div>
      {/* Drop zone — native <button> for keyboard + screen reader semantics; drag handlers stay on the same element */}
      <button
        type="button"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`block min-h-[44px] w-full cursor-pointer rounded-[var(--radius-md)] border-2 border-dashed text-left transition-colors ${
          isDragOver
            ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)]"
            : "border-[var(--color-neutral-300)] hover:border-[var(--color-neutral-400)]"
        } ${compact ? "px-3 py-2" : "px-6 py-4"}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          onChange={handleInputChange}
          className="hidden"
        />
        <div className={`text-center ${compact ? "text-xs" : "text-sm"}`}>
          <p className="font-medium text-[var(--color-neutral-600)]">
            {isDragOver ? "Soltar aquí" : compact ? "+ Añadir fotos" : "Arrastra fotos o haz clic para seleccionar"}
          </p>
          {!compact && (
            <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
              JPG, PNG, WebP, AVIF, GIF (max 10MB) o MP4 (max 100MB)
            </p>
          )}
        </div>
      </button>

      {/* Upload progress */}
      {jobs.length > 0 && (
        <div className="mt-2 space-y-1">
          {jobs.map((job) => (
              <div
                key={job.id}
                className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-xs ${
                  job.progress === "error"
                    ? "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
                    : "bg-[var(--color-neutral-50)] text-[var(--color-neutral-600)]"
                }`}
              >
                {job.progress !== "error" && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-primary-400)] border-t-transparent" />
                )}
                <span className="truncate">{job.fileName}</span>
                <span className="ml-auto shrink-0">
                  {job.progress === "requesting" && "Preparando..."}
                  {job.progress === "uploading" && "Subiendo..."}
                  {job.progress === "confirming" && "Verificando..."}
                  {job.progress === "assigning" && "Asignando..."}
                  {job.progress === "error" && (job.error || "Error")}
                </span>
              </div>
            ))}
          {hasErrors && (
            <button
              type="button"
              onClick={clearFinished}
              className="text-xs text-[var(--color-neutral-500)] underline"
            >
              Limpiar errores
            </button>
          )}
        </div>
      )}
    </div>
  );
}
