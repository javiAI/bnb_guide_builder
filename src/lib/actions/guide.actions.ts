"use server";

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { composeGuide } from "@/lib/services/guide-rendering.service";
import type { GuideTree } from "@/lib/types/guide-tree";

export type ActionResult = {
  success: boolean;
  error?: string;
};

// ──────────────────────────────────────────────
// Publish — snapshot the live GuideTree as a new version
// ──────────────────────────────────────────────

export async function publishGuideVersionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) return { success: false, error: "propertyId requerido" };

  // Verify property exists
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  // Compose the live tree with audience=internal (max detail)
  const tree: GuideTree = await composeGuide(propertyId, "internal");

  // Determine next version number
  const latest = await prisma.guideVersion.findFirst({
    where: { propertyId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  // Unpublish any currently-published version
  await prisma.guideVersion.updateMany({
    where: { propertyId, status: "published" },
    data: { status: "archived" },
  });

  // Create new published version with snapshot
  await prisma.guideVersion.create({
    data: {
      version: nextVersion,
      status: "published",
      treeJson: tree as unknown as Prisma.InputJsonValue,
      publishedAt: new Date(),
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/publishing`);
  revalidatePath(`/properties/${propertyId}/guest-guide`);
  return { success: true };
}

// ──────────────────────────────────────────────
// Unpublish — archive the currently published version
// ──────────────────────────────────────────────

export async function unpublishVersionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const versionId = formData.get("versionId") as string;
  if (!versionId) return { success: false, error: "versionId requerido" };

  const version = await prisma.guideVersion.findUnique({
    where: { id: versionId },
    select: { id: true, propertyId: true, status: true },
  });
  if (!version) return { success: false, error: "Versión no encontrada" };
  if (version.status !== "published") {
    return { success: false, error: "Solo se pueden despublicar versiones publicadas" };
  }

  await prisma.guideVersion.update({
    where: { id: versionId },
    data: { status: "archived" },
  });

  revalidatePath(`/properties/${version.propertyId}/publishing`);
  revalidatePath(`/properties/${version.propertyId}/guest-guide`);
  return { success: true };
}

// ──────────────────────────────────────────────
// Rollback — create a new version from an old snapshot
// ──────────────────────────────────────────────

export async function rollbackToVersionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sourceVersionId = formData.get("sourceVersionId") as string;
  if (!sourceVersionId) return { success: false, error: "sourceVersionId requerido" };

  const source = await prisma.guideVersion.findUnique({
    where: { id: sourceVersionId },
    select: { id: true, propertyId: true, treeJson: true },
  });
  if (!source) return { success: false, error: "Versión fuente no encontrada" };
  if (!source.treeJson) return { success: false, error: "La versión fuente no tiene snapshot" };

  // Determine next version number
  const latest = await prisma.guideVersion.findFirst({
    where: { propertyId: source.propertyId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  // Archive current published
  await prisma.guideVersion.updateMany({
    where: { propertyId: source.propertyId, status: "published" },
    data: { status: "archived" },
  });

  // Create new version from old snapshot
  await prisma.guideVersion.create({
    data: {
      version: nextVersion,
      status: "published",
      treeJson: source.treeJson as Prisma.InputJsonValue,
      publishedAt: new Date(),
      property: { connect: { id: source.propertyId } },
    },
  });

  revalidatePath(`/properties/${source.propertyId}/publishing`);
  revalidatePath(`/properties/${source.propertyId}/guest-guide`);
  return { success: true };
}
