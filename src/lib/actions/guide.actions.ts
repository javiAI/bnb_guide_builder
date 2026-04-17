"use server";

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { composeGuide } from "@/lib/services/guide-rendering.service";
import { ensurePropertySlug } from "@/lib/services/guide-slug.service";
import { isPrismaUniqueViolation } from "@/lib/utils";
import {
  GUIDE_TREE_SCHEMA_VERSION,
  type GuideTree,
} from "@/lib/types/guide-tree";
import type { ActionResult } from "@/lib/types/action-result";

/** Cache tag used by `app/g/[slug]/page.tsx` (via `unstable_cache` or
 * `fetch({ next: { tags: [...] }})`) so publishing flows can invalidate the
 * ISR-cached public page without path-guessing. */
export function guideCacheTag(publicSlug: string): string {
  return `guide-${publicSlug}`;
}

async function revalidatePublishingPaths(
  propertyId: string,
  publicSlug?: string | null,
): Promise<void> {
  revalidatePath(`/properties/${propertyId}/publishing`);
  revalidatePath(`/properties/${propertyId}/guest-guide`);
  let slug = publicSlug ?? null;
  if (!slug) {
    const prop = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { publicSlug: true },
    });
    slug = prop?.publicSlug ?? null;
  }
  if (slug) {
    revalidatePath(`/g/${slug}`);
    revalidateTag(guideCacheTag(slug));
  }
}

// ──────────────────────────────────────────────
// Publish — snapshot the live GuideTree as a new version
// ──────────────────────────────────────────────

export async function publishGuideVersionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) return { success: false, error: "propertyId requerido" };

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  // Ensure slug BEFORE composing — media URLs in treeJson are baked with this
  // slug, so a first-publish where publicSlug is still null would otherwise
  // snapshot broken `/g/null/media/...` paths. If slug generation fails we
  // still publish, but media URLs fall back to asset-only paths (slug=null)
  // and will resolve correctly once the user retries or hits the public URL.
  let publicSlug: string | null = null;
  try {
    publicSlug = await ensurePropertySlug(propertyId);
  } catch (err) {
    console.error(
      `Property ${propertyId} slug generation failed — publishing without baked slug.`,
      err,
    );
  }

  const tree: GuideTree = await composeGuide(propertyId, "internal", publicSlug);

  try {
    await prisma.$transaction(async (tx) => {
      const latest = await tx.guideVersion.findFirst({
        where: { propertyId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      await tx.guideVersion.updateMany({
        where: { propertyId, status: "published" },
        data: { status: "archived" },
      });

      await tx.guideVersion.create({
        data: {
          version: nextVersion,
          status: "published",
          treeJson: tree as unknown as Prisma.InputJsonValue,
          treeSchemaVersion: GUIDE_TREE_SCHEMA_VERSION,
          publishedAt: new Date(),
          property: { connect: { id: propertyId } },
        },
      });
    });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return { success: false, error: "Conflicto de versión — reintenta" };
    }
    throw err;
  }

  await revalidatePublishingPaths(propertyId, publicSlug);
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

  // Archive ALL published versions for this property (not just the clicked one)
  // to ensure no stale published version remains if data is inconsistent.
  await prisma.guideVersion.updateMany({
    where: { propertyId: version.propertyId, status: "published" },
    data: { status: "archived" },
  });

  await revalidatePublishingPaths(version.propertyId);
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
    select: {
      id: true,
      propertyId: true,
      status: true,
      treeJson: true,
      treeSchemaVersion: true,
    },
  });
  if (!source) return { success: false, error: "Versión fuente no encontrada" };
  if (source.status !== "archived") {
    return { success: false, error: "Solo se puede restaurar una versión archivada" };
  }
  if (!source.treeJson) return { success: false, error: "La versión fuente no tiene snapshot" };

  try {
    await prisma.$transaction(async (tx) => {
      const latest = await tx.guideVersion.findFirst({
        where: { propertyId: source.propertyId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      await tx.guideVersion.updateMany({
        where: { propertyId: source.propertyId, status: "published" },
        data: { status: "archived" },
      });

      await tx.guideVersion.create({
        data: {
          version: nextVersion,
          status: "published",
          treeJson: source.treeJson as Prisma.InputJsonValue,
          // Preserve the source snapshot's schema — the old JSON shape is
          // already baked, bumping to v2 here would lie about the payload.
          treeSchemaVersion: source.treeSchemaVersion,
          publishedAt: new Date(),
          property: { connect: { id: source.propertyId } },
        },
      });
    });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return { success: false, error: "Conflicto de versión — reintenta" };
    }
    throw err;
  }

  await revalidatePublishingPaths(source.propertyId);
  return { success: true };
}
