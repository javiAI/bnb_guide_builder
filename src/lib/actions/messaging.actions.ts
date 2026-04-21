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
import {
  bodyUsesInternalOnly,
  editDraftBody,
  transitionDraftAction,
  type DraftLifecycleAction,
} from "@/lib/services/messaging-automation.service";
import {
  applyStarterPack,
  previewPack,
  type ApplyStarterPackResult,
  type StarterPackPreview,
} from "@/lib/services/messaging-seed.service";
import { ORIGIN_USER } from "@/lib/services/messaging-shared";
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

  // Flip to origin="user" only when the host changed the actual copy
  // (body or subject). Pure status/channel toggles on a pack template must
  // NOT detach it — otherwise activating a seeded template permanently
  // removes it from future pack refreshes.
  const current = await prisma.messageTemplate.findUnique({
    where: { id: templateId },
    select: { bodyMd: true, subjectLine: true, origin: true },
  });
  const contentChanged =
    !!current &&
    (current.bodyMd !== result.data.bodyMd ||
      (current.subjectLine ?? null) !== (result.data.subjectLine ?? null));

  const ownershipPatch = contentChanged
    ? { origin: ORIGIN_USER, packId: null }
    : {};

  await prisma.messageTemplate.update({
    where: { id: templateId },
    data: { ...result.data, ...ownershipPatch },
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

// ── Template preview ──

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

  // Safety gate: block automations whose template references `internal_only`
  // variables. Those tokens may never reach a guest — check-time fail is the
  // contract.
  const template = await prisma.messageTemplate.findUnique({
    where: { id: templateId },
    select: { bodyMd: true, propertyId: true },
  });
  if (!template || template.propertyId !== propertyId) {
    return { success: false, error: "Plantilla no encontrada" };
  }
  if (bodyUsesInternalOnly(template.bodyMd)) {
    return {
      success: false,
      error:
        "La plantilla usa variables internas (internal_only) y no puede automatizarse. Edita la plantilla o crea una versión guest-safe.",
    };
  }

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

// ── Message Drafts — lifecycle ──

async function runDraftTransition(
  formData: FormData,
  action: DraftLifecycleAction,
): Promise<ActionResult> {
  const draftId = formData.get("draftId") as string;
  const propertyId = formData.get("propertyId") as string;
  if (!draftId) return { success: false, error: "draftId obligatorio" };

  const result = await transitionDraftAction(draftId, action);
  if (!result.ok) {
    return { success: false, error: result.reason };
  }
  if (propertyId) {
    revalidatePath(`/properties/${propertyId}/messaging/drafts`);
  }
  return { success: true };
}

export async function approveDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runDraftTransition(formData, "approve");
}

export async function skipDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runDraftTransition(formData, "skip");
}

export async function discardDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runDraftTransition(formData, "discard");
}

export async function editDraftBodyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const draftId = formData.get("draftId") as string;
  const propertyId = formData.get("propertyId") as string;
  const bodyMd = (formData.get("bodyMd") as string) ?? "";
  if (!draftId) return { success: false, error: "draftId obligatorio" };
  if (!bodyMd.trim()) {
    return { success: false, fieldErrors: { bodyMd: ["El contenido no puede estar vacío"] } };
  }

  const result = await editDraftBody(draftId, bodyMd);
  if (!result.ok) return { success: false, error: result.reason };

  if (propertyId) {
    revalidatePath(`/properties/${propertyId}/messaging/drafts`);
  }
  return { success: true };
}

// ── Starter packs (rama 12C) ──

export async function previewStarterPackAction(
  propertyId: string,
  packId: string,
): Promise<
  | { success: true; preview: StarterPackPreview }
  | { success: false; error: string }
> {
  if (!propertyId) return { success: false, error: "propertyId requerido" };
  if (!packId) return { success: false, error: "packId requerido" };

  try {
    const preview = await previewPack(packId, propertyId);
    return { success: true, preview };
  } catch (err) {
    return { success: false, error: sanitizeStarterPackError(err) };
  }
}

export async function applyStarterPackAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { result?: ApplyStarterPackResult }> {
  const propertyId = formData.get("propertyId") as string;
  const packId = formData.get("packId") as string;
  if (!propertyId) return { success: false, error: "propertyId requerido" };
  if (!packId) return { success: false, error: "packId requerido" };

  try {
    const result = await applyStarterPack({ packId, propertyId });
    revalidatePath(`/properties/${propertyId}/messaging`);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: sanitizeStarterPackError(err) };
  }
}

function sanitizeStarterPackError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (raw.includes("Unknown starter pack")) return "Pack no encontrado";
  if (raw.includes("Unknown property")) return "Propiedad no encontrada";
  console.error("[starter-pack action]", err);
  return "Error al procesar el pack";
}
