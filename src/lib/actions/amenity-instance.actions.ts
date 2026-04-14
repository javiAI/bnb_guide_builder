"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { stripNulls } from "@/lib/utils";
import {
  createAmenityInstanceSchema,
  updateAmenityInstanceSchema,
} from "@/lib/schemas/editor.schema";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

/** Server actions for PropertyAmenityInstance (+ PropertyAmenityPlacement). */

export async function createAmenityInstanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) return { success: false, error: "Falta el ID de la propiedad" };

  const raw = {
    amenityKey: (formData.get("amenityKey") as string) || "",
    instanceKey: (formData.get("instanceKey") as string) || "default",
    subtypeKey: (formData.get("subtypeKey") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
  };
  const result = createAmenityInstanceSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.propertyAmenityInstance.create({
      data: {
        amenityKey: result.data.amenityKey,
        instanceKey: result.data.instanceKey,
        subtypeKey: result.data.subtypeKey,
        visibility: result.data.visibility ?? "public",
        property: { connect: { id: propertyId } },
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { success: false, error: "Esta instancia ya existe" };
    }
    throw err;
  }

  revalidatePath(`/properties/${propertyId}/amenities`);
  return { success: true };
}

export async function updateAmenityInstanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const amenityId = formData.get("amenityId") as string;
  if (!amenityId) return { success: false, error: "Falta el ID del amenity" };

  const instance = await prisma.propertyAmenityInstance.findUnique({
    where: { id: amenityId },
    select: { propertyId: true },
  });
  if (!instance) return { success: false, error: "Amenity no encontrado" };
  const formPropertyId = formData.get("propertyId") as string | null;
  if (!formPropertyId || formPropertyId !== instance.propertyId) {
    return { success: false, error: "El amenity no pertenece a la propiedad indicada" };
  }

  let detailsJson: Record<string, unknown> | undefined;
  const detailsRaw = formData.get("detailsJson") as string | null;
  if (detailsRaw) {
    try {
      const parsed = JSON.parse(detailsRaw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { success: false, error: "detailsJson inválido" };
      }
      detailsJson = stripNulls(parsed) as Record<string, string | number | boolean | string[] | null>;
    } catch {
      return { success: false, error: "detailsJson inválido" };
    }
  }

  const raw = {
    subtypeKey: (formData.get("subtypeKey") as string) || undefined,
    detailsJson,
    guestInstructions: (formData.get("guestInstructions") as string) || undefined,
    aiInstructions: (formData.get("aiInstructions") as string) || undefined,
    internalNotes: (formData.get("internalNotes") as string) || undefined,
    troubleshootingNotes: (formData.get("troubleshootingNotes") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
  };

  const result = updateAmenityInstanceSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { detailsJson: validatedDetails, ...rest } = result.data;
  const data: Record<string, unknown> = { ...rest };
  if (validatedDetails !== undefined) {
    data.detailsJson = Object.keys(validatedDetails).length > 0 ? validatedDetails : null;
  }

  await prisma.propertyAmenityInstance.update({ where: { id: amenityId }, data });
  revalidatePath(`/properties/${instance.propertyId}/amenities`);
  return { success: true };
}

export async function deleteAmenityInstanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const amenityId = formData.get("amenityId") as string;
  if (!amenityId) return { success: false, error: "Falta el ID del amenity" };

  const instance = await prisma.propertyAmenityInstance.findUnique({
    where: { id: amenityId },
    select: { propertyId: true },
  });
  if (!instance) return { success: false, error: "Amenity no encontrado" };
  const formPropertyId = formData.get("propertyId") as string | null;
  if (!formPropertyId || formPropertyId !== instance.propertyId) {
    return { success: false, error: "El amenity no pertenece a la propiedad indicada" };
  }

  await prisma.propertyAmenityInstance.delete({ where: { id: amenityId } });
  revalidatePath(`/properties/${instance.propertyId}/amenities`);
  return { success: true };
}

export async function addAmenityPlacementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const amenityId = formData.get("amenityId") as string;
  const spaceId = formData.get("spaceId") as string;
  if (!amenityId || !spaceId) return { success: false, error: "Faltan parámetros" };

  const instance = await prisma.propertyAmenityInstance.findUnique({
    where: { id: amenityId },
    select: { propertyId: true },
  });
  if (!instance) return { success: false, error: "Amenity no encontrado" };

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { propertyId: true },
  });
  if (!space) return { success: false, error: "Espacio no encontrado" };
  if (space.propertyId !== instance.propertyId) {
    return { success: false, error: "El espacio no pertenece a la propiedad del amenity" };
  }

  // Only overwrite `note` on update when the form explicitly includes
  // the field; otherwise keep whatever note the placement already has.
  const hasNoteField = formData.has("note");
  const note = hasNoteField ? ((formData.get("note") as string) || null) : null;

  await prisma.propertyAmenityPlacement.upsert({
    where: { amenityId_spaceId: { amenityId, spaceId } },
    create: { amenityId, spaceId, note },
    update: hasNoteField ? { note } : {},
  });

  revalidatePath(`/properties/${instance.propertyId}/amenities`);
  return { success: true };
}

export async function removeAmenityPlacementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const amenityId = formData.get("amenityId") as string;
  const spaceId = formData.get("spaceId") as string;
  if (!amenityId || !spaceId) return { success: false, error: "Faltan parámetros" };

  const instance = await prisma.propertyAmenityInstance.findUnique({
    where: { id: amenityId },
    select: { propertyId: true },
  });
  if (!instance) return { success: false, error: "Amenity no encontrado" };

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { propertyId: true },
  });
  if (!space) return { success: false, error: "Espacio no encontrado" };
  if (space.propertyId !== instance.propertyId) {
    return { success: false, error: "El espacio no pertenece a la propiedad del amenity" };
  }

  await prisma.propertyAmenityPlacement.deleteMany({ where: { amenityId, spaceId } });
  revalidatePath(`/properties/${instance.propertyId}/amenities`);
  return { success: true };
}
