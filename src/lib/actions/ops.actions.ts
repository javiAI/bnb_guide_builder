"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  createChecklistItemSchema,
  updateChecklistItemSchema,
  createStockItemSchema,
  updateStockItemSchema,
  createMaintenanceTaskSchema,
  updateMaintenanceTaskSchema,
} from "@/lib/schemas/ops.schema";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ── Checklist Items ──

export async function createChecklistItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    scopeKey: formData.get("scopeKey") as string,
    title: formData.get("title") as string,
    detailsMd: (formData.get("detailsMd") as string) || undefined,
    estimatedMinutes: formData.get("estimatedMinutes")
      ? Number(formData.get("estimatedMinutes"))
      : undefined,
    required: formData.get("required") === "true",
    sortOrder: formData.get("sortOrder") ? Number(formData.get("sortOrder")) : 0,
  };

  const result = createChecklistItemSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.opsChecklistItem.create({
    data: {
      ...result.data,
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/ops`);
  return { success: true };
}

export async function updateChecklistItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const itemId = formData.get("itemId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    title: formData.get("title") as string,
    detailsMd: (formData.get("detailsMd") as string) || undefined,
    estimatedMinutes: formData.get("estimatedMinutes")
      ? Number(formData.get("estimatedMinutes"))
      : undefined,
    required: formData.has("required") ? formData.get("required") === "true" : undefined,
    sortOrder: formData.get("sortOrder") ? Number(formData.get("sortOrder")) : undefined,
  };

  const result = updateChecklistItemSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.opsChecklistItem.update({
    where: { id: itemId },
    data: result.data,
  });

  revalidatePath(`/properties/${propertyId}/ops`);
  return { success: true };
}

export async function deleteChecklistItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const itemId = formData.get("itemId") as string;
  const propertyId = formData.get("propertyId") as string;

  await prisma.opsChecklistItem.delete({ where: { id: itemId } });

  revalidatePath(`/properties/${propertyId}/ops`);
  return { success: true };
}

// ── Stock Items ──

export async function createStockItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    categoryKey: formData.get("categoryKey") as string,
    name: formData.get("name") as string,
    restockThreshold: formData.get("restockThreshold")
      ? Number(formData.get("restockThreshold"))
      : undefined,
    locationNote: (formData.get("locationNote") as string) || undefined,
    unitLabel: (formData.get("unitLabel") as string) || undefined,
  };

  const result = createStockItemSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.stockItem.create({
    data: {
      ...result.data,
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/ops`);
  return { success: true };
}

export async function deleteStockItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const itemId = formData.get("itemId") as string;
  const propertyId = formData.get("propertyId") as string;

  await prisma.stockItem.delete({ where: { id: itemId } });

  revalidatePath(`/properties/${propertyId}/ops`);
  return { success: true };
}

// ── Maintenance Tasks ──

export async function createMaintenanceTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    taskType: formData.get("taskType") as string,
    title: formData.get("title") as string,
    cadenceKey: (formData.get("cadenceKey") as string) || undefined,
    nextDueAt: (formData.get("nextDueAt") as string) || undefined,
    ownerNote: (formData.get("ownerNote") as string) || undefined,
  };

  const result = createMaintenanceTaskSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.maintenanceTask.create({
    data: {
      ...result.data,
      nextDueAt: result.data.nextDueAt ? new Date(result.data.nextDueAt) : undefined,
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/ops`);
  return { success: true };
}

export async function deleteMaintenanceTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const itemId = formData.get("itemId") as string;
  const propertyId = formData.get("propertyId") as string;

  await prisma.maintenanceTask.delete({ where: { id: itemId } });

  revalidatePath(`/properties/${propertyId}/ops`);
  return { success: true };
}
