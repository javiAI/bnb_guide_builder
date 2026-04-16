"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  ALLOWED_MEDIA,
  buildStorageKey,
  deleteObject,
  getDownloadUrl,
  getUploadUrl,
  headObject,
} from "@/lib/services/media-storage.service";

export type ActionResult<T = void> = {
  success: boolean;
  error?: string;
  data?: T;
};

// ── Helpers ─────────────────────────────────────────────

function isAllowedMimeType(mime: string): boolean {
  return mime in ALLOWED_MEDIA;
}

function maxSizeForMime(mime: string): number {
  return ALLOWED_MEDIA[mime] ?? 0;
}

async function generateBlurhash(
  storageKey: string,
): Promise<string | null> {
  try {
    const url = await getDownloadUrl(storageKey);
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(buffer)
      .resize(32, 32, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { encode } = await import("blurhash");
    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
  } catch {
    return null;
  }
}

function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

// ── Actions ─────────────────────────────────────────────

/**
 * Request a presigned upload URL. Creates a `MediaAsset` in status "pending".
 * Returns the presigned PUT URL + the asset ID.
 */
export async function requestUploadAction(
  propertyId: string,
  fileName: string,
  mimeType: string,
  assetRoleKey: string = "general",
): Promise<ActionResult<{ uploadUrl: string; assetId: string }>> {
  if (!isAllowedMimeType(mimeType)) {
    return {
      success: false,
      error: `Tipo de archivo no permitido: ${mimeType}`,
    };
  }

  const mediaType = isVideoMime(mimeType) ? "video" : "image";
  const maxSize = maxSizeForMime(mimeType);

  const asset = await prisma.mediaAsset.create({
    data: {
      propertyId,
      assetRoleKey,
      mediaType,
      storageKey: "", // placeholder — set after we know the assetId
      mimeType,
      status: "pending",
    },
  });

  const storageKey = buildStorageKey(propertyId, asset.id, fileName);

  await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: { storageKey },
  });

  const uploadUrl = await getUploadUrl(storageKey, mimeType, maxSize);

  return {
    success: true,
    data: { uploadUrl, assetId: asset.id },
  };
}

/**
 * Confirm upload completed. Verifies the object exists in R2, updates
 * sizeBytes, generates blurhash for images, and sets status to "ready".
 */
export async function confirmUploadAction(
  assetId: string,
): Promise<ActionResult> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      storageKey: true,
      status: true,
      mimeType: true,
      propertyId: true,
    },
  });

  if (!asset) {
    return { success: false, error: "Asset no encontrado" };
  }

  if (asset.status !== "pending") {
    return { success: false, error: `Estado inesperado: ${asset.status}` };
  }

  // Verify the object actually exists in R2
  const head = await headObject(asset.storageKey);
  if (!head) {
    return {
      success: false,
      error: "Archivo no encontrado en storage. ¿Se completó el upload?",
    };
  }

  // Validate size
  const maxSize = maxSizeForMime(asset.mimeType);
  if (head.contentLength > maxSize) {
    await deleteObject(asset.storageKey);
    await prisma.mediaAsset.delete({ where: { id: assetId } });
    return {
      success: false,
      error: `Archivo demasiado grande (${Math.round(head.contentLength / 1024 / 1024)}MB). Máximo: ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }

  // Generate blurhash for images (not videos)
  const blurhash = isVideoMime(asset.mimeType)
    ? null
    : await generateBlurhash(asset.storageKey);

  await prisma.mediaAsset.update({
    where: { id: assetId },
    data: {
      sizeBytes: head.contentLength,
      blurhash,
      status: "ready",
    },
  });

  revalidatePath(`/properties/${asset.propertyId}/media`);

  return { success: true };
}

/**
 * Delete a media asset — removes from R2 and DB.
 */
export async function deleteMediaAction(
  assetId: string,
): Promise<ActionResult> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: { id: true, storageKey: true, propertyId: true },
  });

  if (!asset) {
    return { success: false, error: "Asset no encontrado" };
  }

  // Delete from R2 first (if it fails, DB stays consistent)
  try {
    await deleteObject(asset.storageKey);
  } catch {
    // Object may not exist (pending upload that never completed) — continue
  }

  // Cascade deletes MediaAssignment rows
  await prisma.mediaAsset.delete({ where: { id: assetId } });

  revalidatePath(`/properties/${asset.propertyId}/media`);

  return { success: true };
}

/**
 * Get a time-limited download URL for a media asset.
 */
export async function getMediaDownloadUrlAction(
  assetId: string,
): Promise<ActionResult<{ url: string }>> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: { storageKey: true, status: true },
  });

  if (!asset) {
    return { success: false, error: "Asset no encontrado" };
  }

  if (asset.status !== "ready") {
    return { success: false, error: "Asset no está listo" };
  }

  const url = await getDownloadUrl(asset.storageKey);
  return { success: true, data: { url } };
}
