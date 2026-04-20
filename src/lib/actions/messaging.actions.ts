"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  createMessageTemplateSchema,
  updateMessageTemplateSchema,
  createMessageAutomationSchema,
  updateMessageAutomationSchema,
  validateVariables,
  describeUnknownVariable,
} from "@/lib/schemas/messaging.schema";
import { resolveVariables } from "@/lib/services/messaging-variables.service";
import type { ActionResult } from "@/lib/types/action-result";

// ── Variable validation gate ──

/** Run blocking validation of template variables: unknown `{{var}}` tokens
 * produce a fieldError on `bodyMd` with a Spanish-language suggestion.
 * Missing / unresolved_context are NOT blocking — resolution surfaces those
 * at send time (12B) and in the live preview. */
function checkUnknownVariables(bodyMd: string): ActionResult | null {
  const { unknown } = validateVariables(bodyMd);
  if (unknown.length === 0) return null;
  return {
    success: false,
    fieldErrors: {
      bodyMd: unknown.map(describeUnknownVariable),
    },
  };
}

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

  const unknownBlock = checkUnknownVariables(result.data.bodyMd);
  if (unknownBlock) return unknownBlock;

  await prisma.messageTemplate.create({
    data: {
      ...result.data,
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

  const unknownBlock = checkUnknownVariables(result.data.bodyMd);
  if (unknownBlock) return unknownBlock;

  await prisma.messageTemplate.update({
    where: { id: templateId },
    data: result.data,
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

// ── Template preview (rama 12A) ──

export interface TemplatePreviewState {
  status: "resolved" | "missing" | "unknown" | "unresolved_context";
  value?: string;
  label?: string;
  suggestion?: string | null;
}

export interface TemplatePreviewResult {
  success: true;
  output: string;
  states: Record<string, TemplatePreviewState>;
  counts: {
    resolved: number;
    missing: number;
    unknown: number;
    unresolvedContext: number;
  };
}

export interface TemplatePreviewError {
  success: false;
  error: string;
}

/** Preview a template with real property data. Called from the editor (debounced
 * on body change). Cheap: one property query + contact/amenity/KI batch. Never
 * invokes the assistant RAG pipeline. */
export async function previewMessageTemplateAction(
  propertyId: string,
  bodyMd: string,
): Promise<TemplatePreviewResult | TemplatePreviewError> {
  if (!propertyId) {
    return { success: false, error: "propertyId requerido" };
  }
  if (typeof bodyMd !== "string") {
    return { success: false, error: "bodyMd inválido" };
  }

  try {
    const result = await resolveVariables(propertyId, bodyMd);
    const states: Record<string, TemplatePreviewState> = {};
    for (const [token, state] of Object.entries(result.states)) {
      if (state.status === "resolved") {
        states[token] = { status: "resolved", value: state.value };
      } else if (state.status === "missing") {
        states[token] = { status: "missing", label: state.label };
      } else if (state.status === "unresolved_context") {
        states[token] = { status: "unresolved_context", label: state.label };
      } else {
        states[token] = { status: "unknown", suggestion: state.suggestion };
      }
    }
    return {
      success: true,
      output: result.output,
      states,
      counts: {
        resolved: result.resolved.length,
        missing: result.missing.length,
        unknown: result.unknown.length,
        unresolvedContext: result.unresolvedContext.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
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
