"use server";

import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
} from "@/lib/schemas/wizard.schema";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

async function ensureWorkspace(): Promise<string> {
  let workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: "Mi workspace" },
    });
  }
  return workspace.id;
}

export async function createDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const nickname = formData.get("propertyNickname") as string;
  if (!nickname || nickname.trim().length === 0) {
    return { success: false, error: "El nombre es obligatorio" };
  }

  const workspaceId = await ensureWorkspace();

  const property = await prisma.property.create({
    data: {
      workspaceId,
      propertyNickname: nickname.trim(),
      status: "draft",
    },
  });

  await prisma.wizardSession.create({
    data: {
      propertyId: property.id,
      status: "in_progress",
      currentStep: 1,
    },
  });

  redirect(`/properties/new/step-1?propertyId=${property.id}`);
}

export async function saveStep1Action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    propertyType: formData.get("propertyType") as string,
    roomType: formData.get("roomType") as string,
  };

  const result = step1Schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      propertyType: result.data.propertyType,
      roomType: result.data.roomType,
    },
  });

  redirect(`/properties/new/step-2?propertyId=${propertyId}`);
}

export async function saveStep2Action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    country: formData.get("country") as string,
    city: formData.get("city") as string,
    region: (formData.get("region") as string) || undefined,
    postalCode: (formData.get("postalCode") as string) || undefined,
    streetAddress: (formData.get("streetAddress") as string) || undefined,
    addressLevel: (formData.get("addressLevel") as string) || undefined,
    timezone: formData.get("timezone") as string,
  };

  const result = step2Schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: result.data,
  });

  redirect(`/properties/new/step-3?propertyId=${propertyId}`);
}

export async function saveStep3Action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    maxGuests: Number(formData.get("maxGuests")),
    bedroomsCount: Number(formData.get("bedroomsCount")),
    bedsCount: Number(formData.get("bedsCount")),
    bathroomsCount: Number(formData.get("bathroomsCount")),
  };

  const result = step3Schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: result.data,
  });

  redirect(`/properties/new/step-4?propertyId=${propertyId}`);
}

export async function saveStep4Action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    checkInStart: formData.get("checkInStart") as string,
    checkInEnd: formData.get("checkInEnd") as string,
    checkOutTime: formData.get("checkOutTime") as string,
    primaryAccessMethod: formData.get("primaryAccessMethod") as string,
    hostContactPhone: (formData.get("hostContactPhone") as string) || undefined,
    supportContact: (formData.get("supportContact") as string) || undefined,
  };

  const result = step4Schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: result.data,
  });

  redirect(`/properties/new/review?propertyId=${propertyId}`);
}

export async function createUsableAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    return { success: false, error: "Propiedad no encontrada" };
  }

  // Validate minimum fields for usable property
  if (!property.propertyType || !property.roomType) {
    return { success: false, error: "Faltan tipo de alojamiento y espacio" };
  }
  if (!property.country || !property.city || !property.timezone) {
    return { success: false, error: "Faltan datos de ubicación" };
  }
  if (!property.maxGuests || !property.bedsCount || !property.bathroomsCount) {
    return { success: false, error: "Faltan datos de capacidad" };
  }
  if (!property.checkInStart || !property.checkOutTime || !property.primaryAccessMethod) {
    return { success: false, error: "Faltan datos de llegada" };
  }

  // Mark session as completed
  const session = await prisma.wizardSession.findFirst({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  });
  if (session) {
    await prisma.wizardSession.update({
      where: { id: session.id },
      data: { status: "completed", completedAt: new Date() },
    });
  }

  // Activate property
  await prisma.property.update({
    where: { id: propertyId },
    data: { status: "active" },
  });

  redirect(`/properties/${propertyId}`);
}
