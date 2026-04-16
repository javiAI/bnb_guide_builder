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
  invalidateDownloadUrlCache,
} from "@/lib/services/media-storage.service";
import {
  assignMediaSchema,
  reorderMediaSchema,
  VALID_ENTITY_TYPES,
} from "@/lib/schemas/editor.schema";
import type { MediaEntityType } from "@/lib/schemas/editor.schema";

export type ActionResult<T = void> = {
  success: boolean;
  error?: string;
  data?: T;
};

// ── Helpers ─────────────────────────────────────────────

function isAllowedMimeType(mime: string): boolean {
  return Object.hasOwn(ALLOWED_MEDIA, mime);
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
  if (!fileName.trim()) {
    return { success: false, error: "Nombre de archivo requerido" };
  }

  if (!isAllowedMimeType(mimeType)) {
    return {
      success: false,
      error: `Tipo de archivo no permitido: ${mimeType}`,
    };
  }

  const mediaType = isVideoMime(mimeType) ? "video" : "image";

  const { assetId, storageKey } = await prisma.$transaction(async (tx) => {
    const asset = await tx.mediaAsset.create({
      data: {
        propertyId,
        assetRoleKey,
        mediaType,
        storageKey: "", // placeholder — set after we know the assetId
        mimeType,
        status: "pending",
      },
    });

    const key = buildStorageKey(propertyId, asset.id, fileName);

    await tx.mediaAsset.update({
      where: { id: asset.id },
      data: { storageKey: key },
    });

    return { assetId: asset.id, storageKey: key };
  });

  try {
    const uploadUrl = await getUploadUrl(storageKey, mimeType);
    return {
      success: true,
      data: { uploadUrl, assetId },
    };
  } catch {
    await prisma.mediaAsset.delete({ where: { id: assetId } });
    return {
      success: false,
      error: "No se pudo generar la URL de subida",
    };
  }
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

  // Validate content type — strict match required
  if (head.contentType !== asset.mimeType) {
    try { await deleteObject(asset.storageKey); } catch { /* best-effort */ }
    await prisma.mediaAsset.delete({ where: { id: assetId } });
    return {
      success: false,
      error: `Tipo de archivo no coincide: esperado ${asset.mimeType}, recibido ${head.contentType}`,
    };
  }

  // Validate size using the verified content type
  const maxSize = maxSizeForMime(head.contentType);
  if (head.contentLength > maxSize) {
    try { await deleteObject(asset.storageKey); } catch { /* best-effort */ }
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

  invalidateDownloadUrlCache(asset.storageKey);

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

  try {
    const url = await getDownloadUrl(asset.storageKey);
    return { success: true, data: { url } };
  } catch {
    return {
      success: false,
      error: "No se pudo generar el enlace de descarga",
    };
  }
}

// ── Assignment actions ─────────────────────────────────

export type MediaAssignmentWithAsset = {
  id: string;
  mediaAssetId: string;
  entityType: string;
  entityId: string;
  sortOrder: number;
  usageKey: string | null;
  mediaAsset: {
    id: string;
    mimeType: string;
    mediaType: string;
    caption: string | null;
    blurhash: string | null;
    status: string;
    visibility: string;
  };
};

/**
 * Assign a media asset to an entity. Auto-sets sortOrder to last position.
 */
export async function assignMediaAction(
  mediaAssetId: string,
  entityType: MediaEntityType,
  entityId: string,
  usageKey?: string,
): Promise<ActionResult<{ assignmentId: string }>> {
  const parsed = assignMediaSchema.safeParse({ mediaAssetId, entityType, entityId, usageKey });
  if (!parsed.success) {
    return { success: false, error: "Datos de asignación inválidos" };
  }

  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    select: { id: true, propertyId: true, status: true },
  });

  if (!asset) return { success: false, error: "Asset no encontrado" };
  if (asset.status !== "ready") return { success: false, error: "Asset no está listo para asignar" };

  // Validate entity belongs to same property as asset
  if (entityType === "property" || entityType === "access_method") {
    if (entityId !== asset.propertyId) {
      return { success: false, error: "La entidad no pertenece a esta propiedad" };
    }
  } else if (entityType === "space") {
    const space = await prisma.space.findUnique({ where: { id: entityId }, select: { propertyId: true } });
    if (!space || space.propertyId !== asset.propertyId) {
      return { success: false, error: "La entidad no pertenece a esta propiedad" };
    }
  } else if (entityType === "amenity_instance") {
    const amenity = await prisma.propertyAmenityInstance.findUnique({ where: { id: entityId }, select: { propertyId: true } });
    if (!amenity || amenity.propertyId !== asset.propertyId) {
      return { success: false, error: "La entidad no pertenece a esta propiedad" };
    }
  } else if (entityType === "system") {
    const system = await prisma.propertySystem.findUnique({ where: { id: entityId }, select: { propertyId: true } });
    if (!system || system.propertyId !== asset.propertyId) {
      return { success: false, error: "La entidad no pertenece a esta propiedad" };
    }
  }

  // Get next sortOrder for this entity
  const maxOrder = await prisma.mediaAssignment.aggregate({
    where: { entityType, entityId },
    _max: { sortOrder: true },
  });
  const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  try {
    const assignment = await prisma.mediaAssignment.create({
      data: {
        mediaAssetId,
        entityType,
        entityId,
        sortOrder: nextOrder,
        usageKey: usageKey ?? null,
      },
    });

    revalidatePath(`/properties/${asset.propertyId}`, "layout");
    return { success: true, data: { assignmentId: assignment.id } };
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { success: false, error: "Este asset ya está asignado a esta entidad" };
    }
    throw err;
  }
}

/**
 * Remove a media assignment (does NOT delete the underlying asset).
 */
export async function unassignMediaAction(
  assignmentId: string,
): Promise<ActionResult> {
  const assignment = await prisma.mediaAssignment.findUnique({
    where: { id: assignmentId },
    include: { mediaAsset: { select: { propertyId: true } } },
  });

  if (!assignment) return { success: false, error: "Asignación no encontrada" };

  await prisma.mediaAssignment.delete({ where: { id: assignmentId } });

  revalidatePath(`/properties/${assignment.mediaAsset.propertyId}`, "layout");
  return { success: true };
}

/**
 * Reorder assignments for an entity. Receives the full ordered list of assignment IDs.
 */
export async function reorderMediaAction(
  entityType: MediaEntityType,
  entityId: string,
  orderedAssignmentIds: string[],
): Promise<ActionResult> {
  const parsed = reorderMediaSchema.safeParse({ entityType, entityId, orderedAssignmentIds });
  if (!parsed.success) {
    return { success: false, error: "Datos de reordenación inválidos" };
  }

  // Verify all assignments belong to this entity
  const assignments = await prisma.mediaAssignment.findMany({
    where: { entityType, entityId },
    select: { id: true, mediaAsset: { select: { propertyId: true } } },
  });

  const existingIds = new Set(assignments.map((a) => a.id));
  const uniqueIds = new Set(orderedAssignmentIds);
  const allMatch = orderedAssignmentIds.every((id) => existingIds.has(id));
  if (!allMatch || uniqueIds.size !== assignments.length || orderedAssignmentIds.length !== assignments.length) {
    return { success: false, error: "Los IDs de asignación no coinciden con esta entidad" };
  }

  await prisma.$transaction(
    orderedAssignmentIds.map((id, index) =>
      prisma.mediaAssignment.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  const propertyId = assignments[0]?.mediaAsset.propertyId;
  if (propertyId) revalidatePath(`/properties/${propertyId}`, "layout");

  return { success: true };
}

/**
 * Set an assignment as the cover photo for its entity.
 * Clears any previous cover for the same entity.
 */
export async function setCoverAction(
  assignmentId: string,
): Promise<ActionResult> {
  const assignment = await prisma.mediaAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      mediaAsset: { select: { propertyId: true } },
    },
  });

  if (!assignment) return { success: false, error: "Asignación no encontrada" };

  // Clear previous cover for this entity, then set the new one
  await prisma.$transaction([
    prisma.mediaAssignment.updateMany({
      where: {
        entityType: assignment.entityType,
        entityId: assignment.entityId,
        usageKey: "cover",
      },
      data: { usageKey: null },
    }),
    prisma.mediaAssignment.update({
      where: { id: assignmentId },
      data: { usageKey: "cover" },
    }),
  ]);

  revalidatePath(`/properties/${assignment.mediaAsset.propertyId}`, "layout");
  return { success: true };
}

/**
 * Get all media assignments for an entity, ordered by sortOrder.
 * Returns download URLs for ready assets.
 */
export async function getEntityMediaAction(
  entityType: MediaEntityType,
  entityId: string,
): Promise<ActionResult<{ assignments: (MediaAssignmentWithAsset & { downloadUrl: string | null })[] }>> {
  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return { success: false, error: `Tipo de entidad no válido: ${entityType}` };
  }

  const assignments = await prisma.mediaAssignment.findMany({
    where: { entityType, entityId },
    orderBy: { sortOrder: "asc" },
    include: {
      mediaAsset: {
        select: {
          id: true,
          storageKey: true,
          mimeType: true,
          mediaType: true,
          caption: true,
          blurhash: true,
          status: true,
          visibility: true,
        },
      },
    },
  });

  const withUrls = await Promise.all(
    assignments.map(async (a) => {
      let downloadUrl: string | null = null;
      if (a.mediaAsset.status === "ready") {
        try {
          downloadUrl = await getDownloadUrl(a.mediaAsset.storageKey);
        } catch {
          // URL generation failed — return null, client handles gracefully
        }
      }
      const { storageKey: _, ...assetWithoutKey } = a.mediaAsset;
      return { ...a, mediaAsset: assetWithoutKey, downloadUrl };
    }),
  );

  return { success: true, data: { assignments: withUrls } };
}
