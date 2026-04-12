"use server";

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  propertySchema,
  accessSchema,
  policiesSchema,
  createContactSchema,
  updateContactSchema,
  createSpaceSchema,
  updateSpaceSchema,
  spaceFeaturesSchema,
  createBedSchema,
  updateBedSchema,
  updateAmenitySchema,
  createPlaybookSchema,
  updatePlaybookSchema,
  createLocalPlaceSchema,
  updateLocalPlaceSchema,
  createMediaAssetSchema,
} from "@/lib/schemas/editor.schema";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ── Delete property ──

export async function deletePropertyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) {
    return { success: false, error: "Falta el ID de la propiedad" };
  }

  await prisma.property.delete({ where: { id: propertyId } });

  revalidatePath("/");
  redirect("/");
}

// ── Property editor (replaces basics) ──

export async function savePropertyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    propertyNickname: formData.get("propertyNickname") as string,
    propertyType: formData.get("propertyType") as string,
    roomType: formData.get("roomType") as string,
    customPropertyTypeLabel: (formData.get("customPropertyTypeLabel") as string) || undefined,
    customPropertyTypeDesc: (formData.get("customPropertyTypeDesc") as string) || undefined,
    customRoomTypeLabel: (formData.get("customRoomTypeLabel") as string) || undefined,
    customRoomTypeDesc: (formData.get("customRoomTypeDesc") as string) || undefined,
    country: formData.get("country") as string,
    city: formData.get("city") as string,
    region: (formData.get("region") as string) || undefined,
    postalCode: (formData.get("postalCode") as string) || undefined,
    streetAddress: formData.get("streetAddress") as string,
    addressExtra: (formData.get("addressExtra") as string) || null,
    addressLevel: (formData.get("addressLevel") as string) || undefined,
    timezone: formData.get("timezone") as string,
    maxGuests: Number(formData.get("maxGuests")),
    maxAdults: Number(formData.get("maxAdults")),
    maxChildren: Number(formData.get("maxChildren")),
    infantsAllowed: formData.get("infantsAllowed") === "on" || formData.get("infantsAllowed") === "true",
    bedroomsCount: Number(formData.get("bedroomsCount")),
    bathroomsCount: Number(formData.get("bathroomsCount")),
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
  };

  const result = propertySchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { workspaceId: true },
  });

  const duplicate = await prisma.property.findFirst({
    where: { workspaceId: property.workspaceId, propertyNickname: result.data.propertyNickname, id: { not: propertyId } },
    select: { id: true },
  });
  if (duplicate) {
    return { success: false, error: "Ya existe otra propiedad con ese nombre" };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      ...result.data,
      maxGuests: result.data.maxGuests,
    },
  });

  revalidatePath(`/properties/${propertyId}`);
  return { success: true };
}

// ── Access editor (replaces arrival) ──

export async function saveAccessAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const hasBuildingAccess = formData.get("hasBuildingAccess") === "true";
  const buildingMethods = formData.getAll("buildingMethods") as string[];
  const unitMethods = formData.getAll("unitMethods") as string[];

  const raw = {
    checkInStart: formData.get("checkInStart") as string,
    checkInEnd: formData.get("checkInEnd") as string,
    checkOutTime: formData.get("checkOutTime") as string,
    isAutonomousCheckin: formData.get("isAutonomousCheckin") === "true",
    hasBuildingAccess,
    buildingAccess: hasBuildingAccess ? {
      methods: buildingMethods,
      customLabel: (formData.get("buildingCustomLabel") as string) || null,
      customDesc: (formData.get("buildingCustomDesc") as string) || null,
    } : undefined,
    unitAccess: {
      methods: unitMethods,
      customLabel: (formData.get("unitCustomLabel") as string) || null,
      customDesc: (formData.get("unitCustomDesc") as string) || null,
    },
  };

  const result = accessSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const d = result.data;

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      checkInStart: d.checkInStart,
      checkInEnd: d.checkInEnd,
      checkOutTime: d.checkOutTime,
      isAutonomousCheckin: d.isAutonomousCheckin,
      hasBuildingAccess: d.hasBuildingAccess,
      primaryAccessMethod: d.unitAccess.methods[0] ?? null,
      accessMethodsJson: {
        building: d.buildingAccess ?? null,
        unit: d.unitAccess,
      },
      customAccessMethodLabel: d.unitAccess.customLabel,
      customAccessMethodDesc: d.unitAccess.customDesc,
    },
  });

  revalidatePath(`/properties/${propertyId}`);
  return { success: true };
}

// ── Settings ──

export async function saveSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const propertyNickname = formData.get("propertyNickname") as string;
  const timezone = formData.get("timezone") as string;
  const status = formData.get("status") as string;

  if (!propertyNickname?.trim()) {
    return { success: false, error: "El nombre es obligatorio" };
  }

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { workspaceId: true },
  });

  const duplicate = await prisma.property.findFirst({
    where: { workspaceId: property.workspaceId, propertyNickname: propertyNickname.trim(), id: { not: propertyId } },
    select: { id: true },
  });
  if (duplicate) {
    return { success: false, error: "Ya existe otra propiedad con ese nombre" };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: { propertyNickname: propertyNickname.trim(), timezone, status },
  });

  revalidatePath(`/properties/${propertyId}`);
  return { success: true };
}

// ── Contacts ──

export async function createContactAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    roleKey: formData.get("roleKey") as string,
    entityType: (formData.get("entityType") as string) || "person",
    displayName: formData.get("displayName") as string,
    contactPersonName: (formData.get("contactPersonName") as string) || null,
    phone: (formData.get("phone") as string) || null,
    phoneSecondary: (formData.get("phoneSecondary") as string) || null,
    email: (formData.get("email") as string) || null,
    whatsapp: (formData.get("whatsapp") as string) || null,
    address: (formData.get("address") as string) || null,
    availabilitySchedule: (formData.get("availabilitySchedule") as string) || null,
    emergencyAvailable: formData.get("emergencyAvailable") === "on",
    hasPropertyAccess: formData.get("hasPropertyAccess") === "on",
    internalNotes: (formData.get("internalNotes") as string) || null,
    guestVisibleNotes: (formData.get("guestVisibleNotes") as string) || null,
    visibility: (formData.get("visibility") as string) || "internal",
    isPrimary: formData.get("isPrimary") === "on",
  };

  const result = createContactSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }

  await prisma.contact.create({
    data: {
      ...result.data,
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/contacts`);
  return { success: true };
}

export async function updateContactAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const contactId = formData.get("contactId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    roleKey: formData.get("roleKey") as string,
    entityType: (formData.get("entityType") as string) || "person",
    displayName: formData.get("displayName") as string,
    contactPersonName: (formData.get("contactPersonName") as string) || null,
    phone: (formData.get("phone") as string) || null,
    phoneSecondary: (formData.get("phoneSecondary") as string) || null,
    email: (formData.get("email") as string) || null,
    whatsapp: (formData.get("whatsapp") as string) || null,
    address: (formData.get("address") as string) || null,
    availabilitySchedule: (formData.get("availabilitySchedule") as string) || null,
    emergencyAvailable: formData.get("emergencyAvailable") === "on",
    hasPropertyAccess: formData.get("hasPropertyAccess") === "on",
    internalNotes: (formData.get("internalNotes") as string) || null,
    guestVisibleNotes: (formData.get("guestVisibleNotes") as string) || null,
    visibility: (formData.get("visibility") as string) || "internal",
    isPrimary: formData.get("isPrimary") === "on",
  };

  const result = updateContactSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }

  await prisma.contact.update({
    where: { id: contactId, propertyId },
    data: result.data,
  });

  revalidatePath(`/properties/${propertyId}/contacts`);
  return { success: true };
}

export async function deleteContactAction(
  _prev: { success: boolean } | null,
  formData: FormData,
): Promise<{ success: boolean }> {
  const contactId = formData.get("contactId") as string;
  if (!contactId) return { success: false };

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { propertyId: true },
  });
  if (!contact) return { success: false };

  await prisma.contact.deleteMany({ where: { id: contactId } });
  revalidatePath(`/properties/${contact.propertyId}/contacts`);
  return { success: true };
}

// ── Policies ──

export async function savePoliciesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const policiesRaw = formData.get("policiesJson") as string;

  let parsed: unknown;
  try {
    parsed = JSON.parse(policiesRaw);
  } catch {
    return { success: false, error: "Datos de normas inválidos" };
  }

  const result = policiesSchema.safeParse(parsed);
  if (!result.success) {
    return { success: false, error: "Datos de normas incompletos o inválidos" };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: { policiesJson: result.data },
  });

  revalidatePath(`/properties/${propertyId}`);
  return { success: true };
}

// ── Spaces (S-12, S-13) ──

export async function createSpaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    spaceType: formData.get("spaceType") as string,
    name: formData.get("name") as string,
    guestNotes: (formData.get("guestNotes") as string) || undefined,
    internalNotes: (formData.get("internalNotes") as string) || undefined,
  };

  const result = createSpaceSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.space.create({
    data: {
      ...result.data,
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/spaces`);
  return { success: true };
}

export async function updateSpaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const spaceId = formData.get("spaceId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    name: formData.get("name") as string,
    guestNotes: (formData.get("guestNotes") as string) || undefined,
    aiNotes: (formData.get("aiNotes") as string) || undefined,
    internalNotes: (formData.get("internalNotes") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
  };

  const result = updateSpaceSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.space.update({
    where: { id: spaceId },
    data: result.data,
  });

  revalidatePath(`/properties/${propertyId}/spaces`);
  return { success: true };
}

export async function deleteSpaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const spaceId = formData.get("spaceId") as string;

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { propertyId: true },
  });
  if (!space) return { success: false, error: "Espacio no encontrado" };

  // Null out spaceId on any PropertyAmenity linked to this space (no FK relation, manual cleanup)
  await prisma.propertyAmenity.updateMany({
    where: { spaceId },
    data: { spaceId: null },
  });

  await prisma.space.delete({ where: { id: spaceId } });

  revalidatePath(`/properties/${space.propertyId}/spaces`);
  return { success: true };
}

export async function renameSpaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const spaceId = formData.get("spaceId") as string;
  const name = (formData.get("name") as string)?.trim();

  if (!name) return { success: false, error: "El nombre es obligatorio" };

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { propertyId: true },
  });
  if (!space) return { success: false, error: "Espacio no encontrado" };

  await prisma.space.update({ where: { id: spaceId }, data: { name } });

  revalidatePath(`/properties/${space.propertyId}/spaces`);
  return { success: true };
}

export async function updateSpaceDetailsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const spaceId = formData.get("spaceId") as string;
  const featuresRaw = formData.get("featuresJson") as string | null;
  const guestNotes = (formData.get("guestNotes") as string) || null;
  const aiNotes = (formData.get("aiNotes") as string) || null;
  const internalNotes = (formData.get("internalNotes") as string) || null;

  // Validate visibility server-side — never trust arbitrary client string
  const ALLOWED_VISIBILITIES = ["public", "booked_guest", "internal"] as const;
  const visibilityRaw = formData.get("visibility") as string;
  const visibility = (ALLOWED_VISIBILITIES as readonly string[]).includes(visibilityRaw)
    ? (visibilityRaw as (typeof ALLOWED_VISIBILITIES)[number])
    : "public";

  // Verify space exists and derive propertyId from DB (don't trust client)
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { propertyId: true },
  });
  if (!space) return { success: false, error: "Espacio no encontrado" };

  // Parse and validate featuresJson if provided
  let featuresJson: Record<string, unknown> | null = null;
  if (featuresRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(featuresRaw);
    } catch {
      return { success: false, error: "Datos de características inválidos" };
    }
    const result = spaceFeaturesSchema.safeParse(parsed);
    if (!result.success) {
      return { success: false, error: "Datos de características incorrectos" };
    }
    featuresJson = result.data;
  }

  await prisma.space.update({
    where: { id: spaceId },
    data: {
      guestNotes,
      aiNotes,
      internalNotes,
      visibility,
      ...(featuresJson !== null && { featuresJson: featuresJson as Prisma.InputJsonValue }),
    },
  });

  revalidatePath(`/properties/${space.propertyId}/spaces`);
  return { success: true };
}

// ── Bed configurations ──

export async function addBedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const spaceId = formData.get("spaceId") as string;
  const raw = {
    bedType: formData.get("bedType") as string,
    quantity: Number(formData.get("quantity") ?? 1),
  };

  const result = createBedSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Derive propertyId from DB (don't trust client)
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { propertyId: true },
  });
  if (!space) return { success: false, error: "Espacio no encontrado" };

  // If same bed type already exists in this space, increment quantity
  const existing = await prisma.bedConfiguration.findFirst({
    where: { spaceId, bedType: result.data.bedType },
  });

  if (existing) {
    await prisma.bedConfiguration.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + result.data.quantity },
    });
  } else {
    await prisma.bedConfiguration.create({
      data: {
        ...result.data,
        space: { connect: { id: spaceId } },
      },
    });
  }

  revalidatePath(`/properties/${space.propertyId}/spaces`);
  return { success: true };
}

export async function updateBedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const bedId = formData.get("bedId") as string;
  const spaceId = formData.get("spaceId") as string;
  const raw = {
    bedType: formData.get("bedType") as string,
    quantity: Number(formData.get("quantity") ?? 1),
  };

  const result = updateBedSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Verify ownership: bed must belong to the claimed space
  const bed = await prisma.bedConfiguration.findUnique({
    where: { id: bedId },
    select: { spaceId: true, space: { select: { propertyId: true } } },
  });
  if (!bed || bed.spaceId !== spaceId) {
    return { success: false, error: "Cama no encontrada" };
  }

  await prisma.bedConfiguration.update({
    where: { id: bedId },
    data: result.data,
  });

  revalidatePath(`/properties/${bed.space.propertyId}/spaces`);
  return { success: true };
}

export async function deleteBedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const bedId = formData.get("bedId") as string;
  const spaceId = formData.get("spaceId") as string;

  // Verify ownership: bed must belong to the claimed space
  const bed = await prisma.bedConfiguration.findUnique({
    where: { id: bedId },
    select: { spaceId: true, space: { select: { propertyId: true } } },
  });
  if (!bed || bed.spaceId !== spaceId) {
    return { success: false, error: "Cama no encontrada" };
  }

  await prisma.bedConfiguration.delete({ where: { id: bedId } });

  revalidatePath(`/properties/${bed.space.propertyId}/spaces`);
  return { success: true };
}

// ── Amenities (S-14, S-15) ──

export async function toggleAmenityAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const amenityKey = formData.get("amenityKey") as string;
  const enabled = formData.get("enabled") === "true";

  if (enabled) {
    // Check if already exists
    const existing = await prisma.propertyAmenity.findFirst({
      where: { propertyId, amenityKey },
    });
    if (!existing) {
      await prisma.propertyAmenity.create({
        data: {
          amenityKey,
          property: { connect: { id: propertyId } },
        },
      });
    }
  } else {
    await prisma.propertyAmenity.deleteMany({
      where: { propertyId, amenityKey },
    });
  }

  revalidatePath(`/properties/${propertyId}/amenities`);
  return { success: true };
}

export async function updateAmenityAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const amenityId = formData.get("amenityId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    subtypeKey: (formData.get("subtypeKey") as string) || undefined,
    guestInstructions: (formData.get("guestInstructions") as string) || undefined,
    aiInstructions: (formData.get("aiInstructions") as string) || undefined,
    internalNotes: (formData.get("internalNotes") as string) || undefined,
    troubleshootingNotes: (formData.get("troubleshootingNotes") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
  };

  const result = updateAmenitySchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.propertyAmenity.update({
    where: { id: amenityId },
    data: result.data,
  });

  revalidatePath(`/properties/${propertyId}/amenities`);
  return { success: true };
}

// ── Troubleshooting (S-16, S-17) ──

export async function createPlaybookAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    playbookKey: formData.get("playbookKey") as string,
    title: formData.get("title") as string,
    severity: (formData.get("severity") as string) || undefined,
  };

  const result = createPlaybookSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.troubleshootingPlaybook.create({
    data: {
      ...result.data,
      severity: result.data.severity ?? "medium",
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/troubleshooting`);
  return { success: true };
}

export async function updatePlaybookAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const playbookId = formData.get("playbookId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    title: formData.get("title") as string,
    severity: (formData.get("severity") as string) || undefined,
    symptomsMd: (formData.get("symptomsMd") as string) || undefined,
    guestStepsMd: (formData.get("guestStepsMd") as string) || undefined,
    internalStepsMd: (formData.get("internalStepsMd") as string) || undefined,
    escalationRule: (formData.get("escalationRule") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
  };

  const result = updatePlaybookSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.troubleshootingPlaybook.update({
    where: { id: playbookId },
    data: result.data,
  });

  revalidatePath(`/properties/${propertyId}/troubleshooting`);
  return { success: true };
}

// ── Local Guide (S-18) ──

export async function createLocalPlaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    categoryKey: formData.get("categoryKey") as string,
    name: formData.get("name") as string,
    shortNote: (formData.get("shortNote") as string) || undefined,
    distanceMeters: formData.get("distanceMeters")
      ? Number(formData.get("distanceMeters"))
      : undefined,
  };

  const result = createLocalPlaceSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.localPlace.create({
    data: {
      ...result.data,
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/local-guide`);
  return { success: true };
}

export async function updateLocalPlaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const placeId = formData.get("placeId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    name: formData.get("name") as string,
    shortNote: (formData.get("shortNote") as string) || undefined,
    guestDescription: (formData.get("guestDescription") as string) || undefined,
    aiNotes: (formData.get("aiNotes") as string) || undefined,
    distanceMeters: formData.get("distanceMeters")
      ? Number(formData.get("distanceMeters"))
      : undefined,
    hoursText: (formData.get("hoursText") as string) || undefined,
    linkUrl: (formData.get("linkUrl") as string) || undefined,
    bestFor: (formData.get("bestFor") as string) || undefined,
    seasonalNotes: (formData.get("seasonalNotes") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
  };

  const result = updateLocalPlaceSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.localPlace.update({
    where: { id: placeId },
    data: result.data,
  });

  revalidatePath(`/properties/${propertyId}/local-guide`);
  return { success: true };
}

export async function deleteLocalPlaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const placeId = formData.get("placeId") as string;
  const propertyId = formData.get("propertyId") as string;

  await prisma.localPlace.delete({ where: { id: placeId } });

  revalidatePath(`/properties/${propertyId}/local-guide`);
  return { success: true };
}

// ── Media ──

export async function createMediaAssetAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const raw = {
    assetRoleKey: formData.get("assetRoleKey") as string,
    mediaType: formData.get("mediaType") as string,
    caption: (formData.get("caption") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
  };

  const result = createMediaAssetSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.mediaAsset.create({
    data: {
      ...result.data,
      storageKey: `placeholder_${Date.now()}`,
      mimeType: result.data.mediaType === "photo" ? "image/jpeg" : "video/mp4",
      visibility: result.data.visibility ?? "public",
      status: "pending",
      property: { connect: { id: propertyId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/media`);
  return { success: true };
}

export async function assignMediaAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const mediaAssetId = formData.get("mediaAssetId") as string;
  const entityType = formData.get("entityType") as string;
  const entityId = formData.get("entityId") as string;
  const usageKey = (formData.get("usageKey") as string) || undefined;
  const propertyId = formData.get("propertyId") as string;

  await prisma.mediaAssignment.create({
    data: {
      entityType,
      entityId,
      usageKey,
      mediaAsset: { connect: { id: mediaAssetId } },
    },
  });

  revalidatePath(`/properties/${propertyId}/media`);
  return { success: true };
}
