"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createIncidentSchema,
  updateIncidentSchema,
  type IncidentTargetType,
} from "@/lib/schemas/incident.schema";

export type ActionResult =
  | { success: true }
  | { success: false; error?: string; fieldErrors?: Record<string, string[]> };

function normaliseTarget(
  targetType: IncidentTargetType,
  targetId: string | undefined,
): { targetType: IncidentTargetType; targetId: string | null } {
  if (targetType === "property") return { targetType, targetId: null };
  return { targetType, targetId: targetId ?? null };
}

async function assertTargetBelongsToProperty(
  propertyId: string,
  targetType: IncidentTargetType,
  targetId: string | null,
): Promise<string | null> {
  if (targetType === "property" || targetType === "access" || !targetId) return null;
  if (targetType === "system") {
    const row = await prisma.propertySystem.findUnique({
      where: { id: targetId },
      select: { propertyId: true },
    });
    if (!row || row.propertyId !== propertyId) return "El sistema no pertenece a la propiedad";
    return null;
  }
  if (targetType === "amenity") {
    const row = await prisma.propertyAmenityInstance.findUnique({
      where: { id: targetId },
      select: { propertyId: true },
    });
    if (!row || row.propertyId !== propertyId) return "La amenity no pertenece a la propiedad";
    return null;
  }
  if (targetType === "space") {
    const row = await prisma.space.findUnique({
      where: { id: targetId },
      select: { propertyId: true },
    });
    if (!row || row.propertyId !== propertyId) return "El espacio no pertenece a la propiedad";
    return null;
  }
  return null;
}

async function assertPlaybookBelongsToProperty(
  propertyId: string,
  playbookId: string | null,
): Promise<string | null> {
  if (!playbookId) return null;
  const row = await prisma.troubleshootingPlaybook.findUnique({
    where: { id: playbookId },
    select: { propertyId: true },
  });
  if (!row || row.propertyId !== propertyId) return "El playbook no pertenece a la propiedad";
  return null;
}

export async function createIncidentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) return { success: false, error: "Falta propertyId" };

  const raw = {
    title: formData.get("title") as string,
    severity: (formData.get("severity") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
    targetType: formData.get("targetType") as string,
    targetId: (formData.get("targetId") as string) || undefined,
    playbookId: (formData.get("playbookId") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
    occurredAt: (formData.get("occurredAt") as string) || new Date().toISOString(),
  };

  const result = createIncidentSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { targetType, targetId } = normaliseTarget(result.data.targetType, result.data.targetId);
  const targetErr = await assertTargetBelongsToProperty(propertyId, targetType, targetId);
  if (targetErr) return { success: false, error: targetErr };

  const playbookId = result.data.playbookId || null;
  const pbErr = await assertPlaybookBelongsToProperty(propertyId, playbookId);
  if (pbErr) return { success: false, error: pbErr };

  await prisma.incident.create({
    data: {
      propertyId,
      title: result.data.title,
      severity: result.data.severity ?? "medium",
      status: result.data.status ?? "open",
      targetType,
      targetId,
      playbookId,
      notes: result.data.notes,
      visibility: result.data.visibility ?? "internal",
      occurredAt: new Date(result.data.occurredAt),
    },
  });

  revalidatePath(`/properties/${propertyId}/troubleshooting/incidents`);
  return { success: true };
}

export async function updateIncidentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const incidentId = formData.get("incidentId") as string;
  if (!incidentId) return { success: false, error: "Falta el ID de la ocurrencia" };

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { propertyId: true },
  });
  if (!incident) return { success: false, error: "Ocurrencia no encontrada" };

  const raw = {
    title: formData.get("title") as string,
    severity: (formData.get("severity") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
    targetType: formData.get("targetType") as string,
    targetId: (formData.get("targetId") as string) || undefined,
    playbookId: (formData.get("playbookId") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
    occurredAt: formData.get("occurredAt") as string,
    resolvedAt: (formData.get("resolvedAt") as string) || undefined,
  };

  const result = updateIncidentSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { targetType, targetId } = normaliseTarget(result.data.targetType, result.data.targetId);
  const targetErr = await assertTargetBelongsToProperty(incident.propertyId, targetType, targetId);
  if (targetErr) return { success: false, error: targetErr };

  const playbookId = result.data.playbookId || null;
  const pbErr = await assertPlaybookBelongsToProperty(incident.propertyId, playbookId);
  if (pbErr) return { success: false, error: pbErr };

  // Auto-stamp resolvedAt when transitioning to resolved without explicit value
  let resolvedAt: Date | null = null;
  if (result.data.resolvedAt) {
    resolvedAt = new Date(result.data.resolvedAt);
  } else if (result.data.status === "resolved") {
    resolvedAt = new Date();
  }

  await prisma.incident.update({
    where: { id: incidentId },
    data: {
      title: result.data.title,
      severity: result.data.severity ?? "medium",
      status: result.data.status ?? "open",
      targetType,
      targetId,
      playbookId,
      notes: result.data.notes,
      visibility: result.data.visibility ?? "internal",
      occurredAt: new Date(result.data.occurredAt),
      resolvedAt,
    },
  });

  revalidatePath(`/properties/${incident.propertyId}/troubleshooting/incidents`);
  return { success: true };
}

export async function deleteIncidentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const incidentId = formData.get("incidentId") as string;
  if (!incidentId) return { success: false, error: "Falta el ID de la ocurrencia" };

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { propertyId: true },
  });
  if (!incident) return { success: false, error: "Ocurrencia no encontrada" };

  await prisma.incident.delete({ where: { id: incidentId } });
  revalidatePath(`/properties/${incident.propertyId}/troubleshooting/incidents`);
  return { success: true };
}

export async function resolveIncidentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const incidentId = formData.get("incidentId") as string;
  if (!incidentId) return { success: false, error: "Falta el ID de la ocurrencia" };

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { propertyId: true },
  });
  if (!incident) return { success: false, error: "Ocurrencia no encontrada" };

  await prisma.incident.update({
    where: { id: incidentId },
    data: { status: "resolved", resolvedAt: new Date() },
  });
  revalidatePath(`/properties/${incident.propertyId}/troubleshooting/incidents`);
  return { success: true };
}
