"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createIncidentSchema,
  updateIncidentSchema,
  type IncidentTargetType,
} from "@/lib/schemas/incident.schema";
import { zonedLocalToUTC } from "@/lib/property-timezone";
import { accessMethods, findItem } from "@/lib/taxonomy-loader";
import type { ActionResult } from "@/lib/types/action-result";

function normalizeTarget(
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
  if (targetType === "property" || !targetId) return null;
  if (targetType === "access") {
    if (!findItem(accessMethods, targetId)) return "Método de acceso desconocido";
    return null;
  }
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
    if (!row || row.propertyId !== propertyId) return "La amenidad no pertenece a la propiedad";
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

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, timezone: true },
  });
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  const raw = {
    title: formData.get("title") as string,
    severity: (formData.get("severity") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
    targetType: formData.get("targetType") as string,
    targetId: (formData.get("targetId") as string) || undefined,
    playbookId: (formData.get("playbookId") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
    occurredAt: (formData.get("occurredAt") as string) || undefined,
  };

  const result = createIncidentSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { targetType, targetId } = normalizeTarget(result.data.targetType, result.data.targetId);
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
      occurredAt: zonedLocalToUTC(result.data.occurredAt, property.timezone),
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
    select: {
      propertyId: true,
      status: true,
      resolvedAt: true,
      visibility: true,
      playbookId: true,
      property: { select: { timezone: true } },
    },
  });
  if (!incident) return { success: false, error: "Ocurrencia no encontrada" };
  const propertyTimezone = incident.property.timezone;

  const playbookRaw = formData.get("playbookId");
  const visibilityRaw = formData.get("visibility");

  const raw = {
    title: formData.get("title") as string,
    severity: formData.get("severity") as string,
    status: formData.get("status") as string,
    targetType: formData.get("targetType") as string,
    targetId: (formData.get("targetId") as string) || undefined,
    playbookId: typeof playbookRaw === "string" ? playbookRaw || undefined : undefined,
    notes: (formData.get("notes") as string) || undefined,
    visibility: typeof visibilityRaw === "string" ? visibilityRaw || undefined : undefined,
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

  const { targetType, targetId } = normalizeTarget(result.data.targetType, result.data.targetId);
  const targetErr = await assertTargetBelongsToProperty(incident.propertyId, targetType, targetId);
  if (targetErr) return { success: false, error: targetErr };

  // playbookId: preserve existing when field absent; treat empty string as explicit clear.
  const playbookId =
    playbookRaw === null
      ? incident.playbookId
      : typeof playbookRaw === "string" && playbookRaw.length > 0
        ? playbookRaw
        : null;
  const pbErr = await assertPlaybookBelongsToProperty(incident.propertyId, playbookId);
  if (pbErr) return { success: false, error: pbErr };

  // visibility: preserve existing when field absent.
  const visibility =
    visibilityRaw === null ? incident.visibility : (result.data.visibility ?? "internal");

  // resolvedAt derivation:
  //   - explicit value in form → use it
  //   - transitioning into "resolved" → stamp now
  //   - transitioning out of "resolved" → clear
  //   - otherwise → preserve existing value
  let resolvedAt: Date | null;
  if (result.data.resolvedAt) {
    resolvedAt = zonedLocalToUTC(result.data.resolvedAt, propertyTimezone);
  } else if (result.data.status === "resolved" && incident.status !== "resolved") {
    resolvedAt = new Date();
  } else if (result.data.status !== "resolved" && incident.status === "resolved") {
    resolvedAt = null;
  } else {
    resolvedAt = incident.resolvedAt;
  }

  await prisma.incident.update({
    where: { id: incidentId },
    data: {
      title: result.data.title,
      severity: result.data.severity,
      status: result.data.status,
      targetType,
      targetId,
      playbookId,
      notes: result.data.notes,
      visibility,
      occurredAt: zonedLocalToUTC(result.data.occurredAt, propertyTimezone),
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

// Rama 13D — status change from the guest-incidents panel (list + detail
// views). Accepts the finite set of statuses tracked in the schema and
// auto-stamps `resolvedAt` when entering `resolved`, clearing it on exit.
const ALLOWED_STATUSES = ["open", "in_progress", "resolved", "cancelled"] as const;
type IncidentStatus = (typeof ALLOWED_STATUSES)[number];

export async function changeIncidentStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const incidentId = formData.get("incidentId") as string;
  const propertyId = formData.get("propertyId") as string;
  const nextStatus = formData.get("status") as string;
  if (!incidentId) return { success: false, error: "Falta el ID de la incidencia" };
  if (!propertyId) return { success: false, error: "Falta el ID de la propiedad" };
  if (!ALLOWED_STATUSES.includes(nextStatus as IncidentStatus)) {
    return { success: false, error: "Estado no válido" };
  }

  // Scope the read+write to the propertyId from the form context so a
  // tampered incidentId from a different property never targets another
  // property's row. `findFirst` with the composite filter returns null for
  // cross-property attempts, collapsing them to "not found".
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, propertyId },
    select: { status: true, resolvedAt: true },
  });
  if (!incident) return { success: false, error: "Incidencia no encontrada" };

  // resolvedAt: stamp on entry, clear on exit, preserve otherwise.
  let resolvedAt: Date | null = incident.resolvedAt;
  if (nextStatus === "resolved" && incident.status !== "resolved") {
    resolvedAt = new Date();
  } else if (nextStatus !== "resolved" && incident.status === "resolved") {
    resolvedAt = null;
  }

  // updateMany with the composite filter ensures the write only lands if the
  // row still belongs to the same property — matches the ownership gate.
  await prisma.incident.updateMany({
    where: { id: incidentId, propertyId },
    data: { status: nextStatus, resolvedAt },
  });

  revalidatePath(`/properties/${propertyId}/incidents`);
  revalidatePath(`/properties/${propertyId}/incidents/${incidentId}`);
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
