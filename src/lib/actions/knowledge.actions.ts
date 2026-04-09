"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  createKnowledgeItemSchema,
  updateKnowledgeItemSchema,
  updateGuideSectionSchema,
  createGuideSectionItemSchema,
} from "@/lib/schemas/knowledge.schema";
import { getRenderConfigsForTarget } from "@/config/registries/renderer-registry";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ── Knowledge Items ──

export async function createKnowledgeItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    topic: formData.get("topic") as string,
    bodyMd: formData.get("bodyMd") as string,
    visibility: (formData.get("visibility") as string) || undefined,
    journeyStage: (formData.get("journeyStage") as string) || undefined,
  };

  const result = createKnowledgeItemSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Enforce: secret visibility not allowed in knowledge items
  if (result.data.visibility === "secret") {
    return { success: false, error: "Los items de conocimiento no pueden tener visibilidad 'secret'." };
  }

  await prisma.knowledgeItem.create({
    data: {
      ...result.data,
      visibility: result.data.visibility ?? "public",
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/knowledge`);
  return { success: true };
}

export async function updateKnowledgeItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const itemId = formData.get("itemId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    topic: formData.get("topic") as string,
    bodyMd: formData.get("bodyMd") as string,
    visibility: (formData.get("visibility") as string) || undefined,
    journeyStage: (formData.get("journeyStage") as string) || undefined,
  };

  const result = updateKnowledgeItemSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  if (result.data.visibility === "secret") {
    return { success: false, error: "Los items de conocimiento no pueden tener visibilidad 'secret'." };
  }

  await prisma.knowledgeItem.update({
    where: { id: itemId },
    data: {
      ...result.data,
      lastVerifiedAt: new Date(),
    },
  });

  revalidatePath(`/properties/${propertyId}/knowledge`);
  return { success: true };
}

export async function deleteKnowledgeItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const itemId = formData.get("itemId") as string;
  const propertyId = formData.get("propertyId") as string;

  // Delete citations first
  await prisma.knowledgeCitation.deleteMany({
    where: { knowledgeItemId: itemId },
  });

  await prisma.knowledgeItem.delete({ where: { id: itemId } });

  revalidatePath(`/properties/${propertyId}/knowledge`);
  return { success: true };
}

// ── Guide Versions ──

export async function createGuideVersionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;

  // Get latest version number
  const latest = await prisma.guideVersion.findFirst({
    where: { propertyId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  // Create version with sections from renderer config
  const guideConfigs = getRenderConfigsForTarget("guest_guide");

  const guideVersion = await prisma.guideVersion.create({
    data: {
      version: nextVersion,
      status: "draft",
      property: { connect: { id: propertyId } },
    },
  });

  // Create sections from render configs
  for (let i = 0; i < guideConfigs.length; i++) {
    const config = guideConfigs[i];
    await prisma.guideSection.create({
      data: {
        sectionKey: config.sectionKey,
        title: config.guideSectionType ?? config.sectionKey,
        sortOrder: i,
        guideVersion: { connect: { id: guideVersion.id } },
      },
    });
  }

  revalidatePath(`/properties/${propertyId}/guest-guide`);
  return { success: true };
}

export async function publishGuideVersionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const versionId = formData.get("versionId") as string;
  const propertyId = formData.get("propertyId") as string;

  // Snapshot publish — mark as published, don't overwrite previous
  await prisma.guideVersion.update({
    where: { id: versionId },
    data: {
      status: "published",
      publishedAt: new Date(),
    },
  });

  revalidatePath(`/properties/${propertyId}/guest-guide`);
  revalidatePath(`/properties/${propertyId}/publishing`);
  return { success: true };
}

// ── Guide Section Items ──

export async function updateGuideSectionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sectionId = formData.get("sectionId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    title: formData.get("title") as string,
    sortOrder: formData.get("sortOrder") ? Number(formData.get("sortOrder")) : undefined,
  };

  const result = updateGuideSectionSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.guideSection.update({
    where: { id: sectionId },
    data: result.data,
  });

  revalidatePath(`/properties/${propertyId}/guest-guide`);
  return { success: true };
}

export async function createGuideSectionItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sectionId = formData.get("sectionId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    contentMd: formData.get("contentMd") as string,
    visibility: (formData.get("visibility") as string) || undefined,
    sortOrder: formData.get("sortOrder") ? Number(formData.get("sortOrder")) : undefined,
  };

  const result = createGuideSectionItemSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Enforce: secret visibility not allowed in guide items
  if (result.data.visibility === "secret") {
    return { success: false, error: "Los items de guía no pueden tener visibilidad 'secret'." };
  }

  await prisma.guideSectionItem.create({
    data: {
      ...result.data,
      visibility: result.data.visibility ?? "public",
      guideSection: { connect: { id: sectionId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/guest-guide`);
  return { success: true };
}

export async function deleteGuideSectionItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const itemId = formData.get("itemId") as string;
  const propertyId = formData.get("propertyId") as string;

  await prisma.guideSectionItem.delete({ where: { id: itemId } });

  revalidatePath(`/properties/${propertyId}/guest-guide`);
  return { success: true };
}
