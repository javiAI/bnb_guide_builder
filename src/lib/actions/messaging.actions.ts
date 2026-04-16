"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  createMessageTemplateSchema,
  updateMessageTemplateSchema,
  createMessageAutomationSchema,
  updateMessageAutomationSchema,
  validateVariables,
} from "@/lib/schemas/messaging.schema";
import type { ActionResult } from "@/lib/types/action-result";

// ── Message Templates ──

export async function createMessageTemplateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    touchpointKey: formData.get("touchpointKey") as string,
    channelKey: (formData.get("channelKey") as string) || undefined,
    subjectLine: (formData.get("subjectLine") as string) || undefined,
    bodyMd: formData.get("bodyMd") as string,
    language: (formData.get("language") as string) || "es",
  };

  const result = createMessageTemplateSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Variable validation warning (non-blocking)
  const { unknown } = validateVariables(result.data.bodyMd);

  await prisma.messageTemplate.create({
    data: {
      ...result.data,
      variablesJson: unknown.length > 0 ? { unknownVars: unknown } : undefined,
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/messaging`);
  return { success: true };
}

export async function updateMessageTemplateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const templateId = formData.get("templateId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    channelKey: (formData.get("channelKey") as string) || undefined,
    subjectLine: (formData.get("subjectLine") as string) || undefined,
    bodyMd: formData.get("bodyMd") as string,
    status: (formData.get("status") as string) || undefined,
  };

  const result = updateMessageTemplateSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { unknown } = validateVariables(result.data.bodyMd);

  await prisma.messageTemplate.update({
    where: { id: templateId },
    data: {
      ...result.data,
      variablesJson: unknown.length > 0 ? { unknownVars: unknown } : undefined,
    },
  });

  revalidatePath(`/properties/${propertyId}/messaging`);
  return { success: true };
}

export async function deleteMessageTemplateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const templateId = formData.get("templateId") as string;
  const propertyId = formData.get("propertyId") as string;

  // Delete associated automations first
  await prisma.messageAutomation.deleteMany({
    where: { templateId },
  });

  await prisma.messageTemplate.delete({ where: { id: templateId } });

  revalidatePath(`/properties/${propertyId}/messaging`);
  return { success: true };
}

// ── Message Automations ──

export async function createMessageAutomationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    touchpointKey: formData.get("touchpointKey") as string,
    templateId: formData.get("templateId") as string,
    channelKey: formData.get("channelKey") as string,
    triggerType: formData.get("triggerType") as string,
    sendOffsetMinutes: Number(formData.get("sendOffsetMinutes") ?? 0),
    active: formData.get("active") === "true",
  };

  const result = createMessageAutomationSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { templateId, ...automationData } = result.data;

  await prisma.messageAutomation.create({
    data: {
      ...automationData,
      timezoneSource: "property_timezone",
      property: { connect: { id: propertyId } },
      template: { connect: { id: templateId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/messaging`);
  return { success: true };
}

export async function updateMessageAutomationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const automationId = formData.get("automationId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    channelKey: (formData.get("channelKey") as string) || undefined,
    triggerType: (formData.get("triggerType") as string) || undefined,
    sendOffsetMinutes: formData.get("sendOffsetMinutes")
      ? Number(formData.get("sendOffsetMinutes"))
      : undefined,
    active: formData.has("active") ? formData.get("active") === "true" : undefined,
  };

  const result = updateMessageAutomationSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.messageAutomation.update({
    where: { id: automationId },
    data: result.data,
  });

  revalidatePath(`/properties/${propertyId}/messaging`);
  return { success: true };
}

export async function deleteMessageAutomationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const automationId = formData.get("automationId") as string;
  const propertyId = formData.get("propertyId") as string;

  await prisma.messageAutomation.delete({ where: { id: automationId } });

  revalidatePath(`/properties/${propertyId}/messaging`);
  return { success: true };
}

// ── Message Drafts ──

export async function saveDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const draftId = formData.get("draftId") as string | null;
  const bodyMd = formData.get("bodyMd") as string;
  const channelKey = (formData.get("channelKey") as string) || undefined;

  if (!bodyMd) {
    return { success: false, error: "El contenido es obligatorio" };
  }

  if (draftId) {
    await prisma.messageDraft.update({
      where: { id: draftId },
      data: { bodyMd, channelKey },
    });
  } else {
    await prisma.messageDraft.create({
      data: {
        bodyMd,
        channelKey,
        property: { connect: { id: propertyId } },
      },
    });
  }

  revalidatePath(`/properties/${propertyId}/messaging`);
  return { success: true };
}
