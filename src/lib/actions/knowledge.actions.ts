"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  createKnowledgeItemSchema,
  updateKnowledgeItemSchema,
} from "@/lib/schemas/knowledge.schema";
import { extractFromPropertyAll } from "@/lib/services/knowledge-extract.service";
import type { ActionResult } from "@/lib/types/action-result";

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

  // Enforce: sensitive visibility not allowed in knowledge items
  if (result.data.visibility === "sensitive") {
    return { success: false, error: "Los items de conocimiento no pueden tener visibilidad 'sensible'." };
  }

  await prisma.knowledgeItem.create({
    data: {
      ...result.data,
      visibility: result.data.visibility ?? "guest",
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

  if (result.data.visibility === "sensitive") {
    return { success: false, error: "Los items de conocimiento no pueden tener visibilidad 'sensible'." };
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

export async function regenerateKnowledgeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) return { success: false, error: "Falta el ID de la propiedad" };

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { defaultLocale: true },
  });
  const locale = property?.defaultLocale ?? "es";

  await extractFromPropertyAll(propertyId, locale);

  revalidatePath(`/properties/${propertyId}/knowledge`);
  return { success: true };
}

export async function regenerateLocaleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const locale = formData.get("locale") as string;
  if (!propertyId) return { success: false, error: "Falta el ID de la propiedad" };
  if (!locale) return { success: false, error: "Falta el locale" };

  await extractFromPropertyAll(propertyId, locale);

  revalidatePath(`/properties/${propertyId}/knowledge`);
  return { success: true };
}

