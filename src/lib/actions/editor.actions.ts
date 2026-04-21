"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { recomputePropertyCounts } from "@/lib/property-counts";
import { recomputeAllInBackground } from "@/lib/services/property-derived.service";
import {
  invalidateKnowledgeInBackground,
  deleteEntityChunksInBackground,
  extractFromPropertyAll,
} from "@/lib/services/knowledge-extract.service";
import { findSystemItem, findSubtype, parkingOptions, accessibilityFeatures as accessibilityFeatures_taxonomy } from "@/lib/taxonomy-loader";
import { stripNulls, isPrismaUniqueViolation } from "@/lib/utils";
import { normaliseVisibility } from "@/lib/visibility";
import { instanceKeyFor } from "@/lib/amenity-instance-keys";
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
  bedConfigSchema,
  updateAmenitySchema,
  buildSubtypeDetailsSchema,
  createPlaybookSchema,
  updatePlaybookSchema,
  createLocalPlaceSchema,
  updateLocalPlaceSchema,
  createSystemSchema,
  updateSystemSchema,
  updateSystemCoverageSchema,
} from "@/lib/schemas/editor.schema";
import type { ActionResult } from "@/lib/types/action-result";

// ── Shared helpers ──

function extractContactFields(formData: FormData) {
  return {
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
}

async function assertNicknameUnique(propertyId: string, nickname: string): Promise<ActionResult | null> {
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { workspaceId: true },
  });
  const duplicate = await prisma.property.findFirst({
    where: { workspaceId: property.workspaceId, propertyNickname: nickname, id: { not: propertyId } },
    select: { id: true },
  });
  if (duplicate) {
    return { success: false, error: "Ya existe otra propiedad con ese nombre" };
  }
  return null;
}

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
    layoutKey: (formData.get("layoutKey") as string) || null,
    propertyEnvironment: (formData.get("propertyEnvironment") as string) || null,
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
    hasPrivateEntrance: formData.get("hasPrivateEntrance") === "on" || formData.get("hasPrivateEntrance") === "true",
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
  };

  const infraRaw = formData.get("infrastructureJson") as string | null;
  if (infraRaw) {
    try {
      (raw as Record<string, unknown>).infrastructureJson = JSON.parse(infraRaw);
    } catch {
      return { success: false, error: "Datos de infraestructura inválidos" };
    }
  }

  const result = propertySchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const nicknameError = await assertNicknameUnique(propertyId, result.data.propertyNickname);
  if (nicknameError) return nicknameError;

  await prisma.property.update({
    where: { id: propertyId },
    data: result.data,
  });

  recomputeAllInBackground(propertyId);
  // propertyNickname/city appear in contextPrefix of ALL chunk types; trigger full regen
  extractFromPropertyAll(propertyId).catch((err) => {
    console.error(`[knowledge] full regen failed after saveProperty for ${propertyId}:`, err);
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
  const parkingTypes = formData.getAll("parkingTypes") as string[];
  const accessibilityFeatures = formData.getAll("accessibilityFeatures") as string[];

  // Validate IDs belong to their taxonomies (prevent arbitrary writes via tampered FormData)
  const validParkingIds = new Set(parkingOptions.items.map((i) => i.id));
  const validAccessibilityIds = new Set(accessibilityFeatures_taxonomy.items.map((i) => i.id));

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
    parkingTypes: parkingTypes.filter((id) => validParkingIds.has(id)),
    accessibilityFeatures: accessibilityFeatures.filter((id) => validAccessibilityIds.has(id)),
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
        parking: d.parkingTypes.length > 0 ? { types: d.parkingTypes } : null,
        accessibility: d.accessibilityFeatures.length > 0 ? { features: d.accessibilityFeatures } : null,
      },
      customAccessMethodLabel: d.unitAccess.customLabel,
      customAccessMethodDesc: d.unitAccess.customDesc,
    },
  });

  recomputeAllInBackground(propertyId);
  invalidateKnowledgeInBackground(propertyId, "access", null);
  // checkInStart/checkInEnd/checkOutTime also appear in property-level chunks
  invalidateKnowledgeInBackground(propertyId, "property", null);
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

  const nicknameError = await assertNicknameUnique(propertyId, propertyNickname.trim());
  if (nicknameError) return nicknameError;

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
  const raw = extractContactFields(formData);

  const result = createContactSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const created = await prisma.contact.create({
    data: {
      ...result.data,
      property: { connect: { id: propertyId } },
    },
    select: { id: true },
  });

  invalidateKnowledgeInBackground(propertyId, "contact", created.id);
  revalidatePath(`/properties/${propertyId}/contacts`);
  return { success: true };
}

export async function updateContactAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const contactId = formData.get("contactId") as string;
  const propertyId = formData.get("propertyId") as string;
  const raw = extractContactFields(formData);

  const result = updateContactSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }

  await prisma.contact.update({
    where: { id: contactId, propertyId },
    data: result.data,
  });

  invalidateKnowledgeInBackground(propertyId, "contact", contactId);
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
  deleteEntityChunksInBackground(contact.propertyId, "contact", contactId);
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

  recomputeAllInBackground(propertyId);
  invalidateKnowledgeInBackground(propertyId, "policy", null);
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

  const createdSpaceId = await prisma.$transaction(async (tx) => {
    const created = await tx.space.create({
      data: {
        ...result.data,
        property: { connect: { id: propertyId } },
      },
      select: { id: true },
    });
    await recomputePropertyCounts(tx, propertyId);
    return created.id;
  });

  recomputeAllInBackground(propertyId);
  invalidateKnowledgeInBackground(propertyId, "space", createdSpaceId);
  revalidatePath(`/properties/${propertyId}/spaces`);
  return { success: true };
}

export async function updateSpaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const spaceId = formData.get("spaceId") as string;
  if (!spaceId) return { success: false, error: "Espacio no encontrado" };
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

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { propertyId: true },
  });
  if (!space) return { success: false, error: "Espacio no encontrado" };

  await prisma.space.update({
    where: { id: spaceId },
    data: { ...result.data, createdBy: "user", wizardSeedKey: null },
  });

  recomputeAllInBackground(space.propertyId);
  invalidateKnowledgeInBackground(space.propertyId, "space", spaceId);
  revalidatePath(`/properties/${space.propertyId}/spaces`);
  return { success: true };
}

export async function archiveSpaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const spaceId = formData.get("spaceId") as string;
  const rawStatus = formData.get("status");

  if (!spaceId) return { success: false, error: "Espacio no encontrado" };
  if (rawStatus !== "active" && rawStatus !== "archived") {
    return { success: false, error: "Estado inválido" };
  }
  const nextStatus = rawStatus;

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { propertyId: true },
  });
  if (!space) return { success: false, error: "Espacio no encontrado" };

  await prisma.$transaction(async (tx) => {
    await tx.space.update({ where: { id: spaceId }, data: { status: nextStatus } });
    await recomputePropertyCounts(tx, space.propertyId);
  });

  recomputeAllInBackground(space.propertyId);
  invalidateKnowledgeInBackground(space.propertyId, "space", spaceId);
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

  await prisma.space.update({
    where: { id: spaceId },
    data: { name, createdBy: "user", wizardSeedKey: null },
  });

  invalidateKnowledgeInBackground(space.propertyId, "space", spaceId);
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
  const internalNotes = (formData.get("internalNotes") as string) || null;

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
      internalNotes,
      createdBy: "user",
      wizardSeedKey: null,
      ...(featuresJson !== null && { featuresJson: featuresJson as Prisma.InputJsonValue }),
    },
  });

  recomputeAllInBackground(space.propertyId);
  invalidateKnowledgeInBackground(space.propertyId, "space", spaceId);
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

  const rawCustomLabel = (formData.get("customLabel") as string | null)?.trim() || undefined;
  if (result.data.bedType === "bt.other" && !rawCustomLabel) {
    return { success: false, error: "Las camas personalizadas requieren un nombre" };
  }
  let initialConfigJson: Prisma.InputJsonValue | undefined;
  if (rawCustomLabel !== undefined) {
    const validated = bedConfigSchema.pick({ customLabel: true }).safeParse({ customLabel: rawCustomLabel });
    if (!validated.success) return { success: false, error: "Nombre de cama inválido (máx. 100 caracteres)" };
    initialConfigJson = validated.data as Prisma.InputJsonValue;
  }

  // Derive propertyId from DB (don't trust client)
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { propertyId: true },
  });
  if (!space) return { success: false, error: "Espacio no encontrado" };

  // bt.other: always create a new row (each is a distinct custom bed)
  // Other types: increment quantity if same type already exists
  await prisma.$transaction(async (tx) => {
    if (result.data.bedType === "bt.other") {
      await tx.bedConfiguration.create({
        data: { ...result.data, space: { connect: { id: spaceId } }, configJson: initialConfigJson },
      });
    } else {
      const existing = await tx.bedConfiguration.findFirst({
        where: { spaceId, bedType: result.data.bedType },
      });
      if (existing) {
        await tx.bedConfiguration.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + result.data.quantity, wizardSeedKey: null },
        });
      } else {
        await tx.bedConfiguration.create({
          data: { ...result.data, space: { connect: { id: spaceId } } },
        });
      }
    }
    await tx.space.update({
      where: { id: spaceId },
      data: { createdBy: "user", wizardSeedKey: null },
    });
    await recomputePropertyCounts(tx, space.propertyId);
  });

  recomputeAllInBackground(space.propertyId);
  invalidateKnowledgeInBackground(space.propertyId, "space", spaceId);
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

  await prisma.$transaction(async (tx) => {
    await tx.bedConfiguration.update({
      where: { id: bedId },
      data: { ...result.data, wizardSeedKey: null },
    });
    await tx.space.update({
      where: { id: bed.spaceId },
      data: { createdBy: "user", wizardSeedKey: null },
    });
    await recomputePropertyCounts(tx, bed.space.propertyId);
  });

  recomputeAllInBackground(bed.space.propertyId);
  invalidateKnowledgeInBackground(bed.space.propertyId, "space", bed.spaceId);
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

  await prisma.$transaction(async (tx) => {
    await tx.bedConfiguration.delete({ where: { id: bedId } });
    await tx.space.update({
      where: { id: bed.spaceId },
      data: { createdBy: "user", wizardSeedKey: null },
    });
    await recomputePropertyCounts(tx, bed.space.propertyId);
  });

  recomputeAllInBackground(bed.space.propertyId);
  invalidateKnowledgeInBackground(bed.space.propertyId, "space", bed.spaceId);
  revalidatePath(`/properties/${bed.space.propertyId}/spaces`);
  return { success: true };
}

export async function updateBedConfigAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const bedId = formData.get("bedId") as string;
  const spaceId = formData.get("spaceId") as string;
  const rawJson = formData.get("configJson") as string | null;

  const bed = await prisma.bedConfiguration.findUnique({
    where: { id: bedId },
    select: { spaceId: true, space: { select: { propertyId: true } } },
  });
  if (!bed || bed.spaceId !== spaceId) {
    return { success: false, error: "Cama no encontrada" };
  }

  let configJson: Prisma.InputJsonValue | undefined;
  if (rawJson) {
    let parsed: unknown;
    try { parsed = JSON.parse(rawJson); } catch { return { success: false, error: "Datos inválidos" }; }
    const validated = bedConfigSchema.safeParse(parsed);
    if (!validated.success) return { success: false, error: "Configuración de cama inválida" };
    configJson = validated.data as Prisma.InputJsonValue;
  }

  await prisma.$transaction(async (tx) => {
    await tx.bedConfiguration.update({
      where: { id: bedId },
      data: { configJson, wizardSeedKey: null },
    });
    await tx.space.update({
      where: { id: bed.spaceId },
      data: { createdBy: "user", wizardSeedKey: null },
    });
  });

  recomputeAllInBackground(bed.space.propertyId);
  invalidateKnowledgeInBackground(bed.space.propertyId, "space", bed.spaceId);
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
  const spaceId = (formData.get("spaceId") as string) || null;
  const enabled = formData.get("enabled") === "true";

  if (spaceId) {
    const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { propertyId: true } });
    if (!space || space.propertyId !== propertyId) {
      return { success: false, error: "El espacio no pertenece a la propiedad" };
    }
  }

  const instanceKey = instanceKeyFor(spaceId);

  if (enabled) {
    try {
      await prisma.$transaction(async (tx) => {
        const instance = await tx.propertyAmenityInstance.upsert({
          where: {
            propertyId_amenityKey_instanceKey: { propertyId, amenityKey, instanceKey },
          },
          create: { propertyId, amenityKey, instanceKey },
          update: {},
        });
        if (spaceId) {
          await tx.propertyAmenityPlacement.upsert({
            where: { amenityId_spaceId: { amenityId: instance.id, spaceId } },
            create: { amenityId: instance.id, spaceId },
            update: {},
          });
        }
      });
    } catch (err) {
      if (!isPrismaUniqueViolation(err)) throw err;
    }
  } else {
    await prisma.propertyAmenityInstance.deleteMany({
      where: { propertyId, amenityKey, instanceKey },
    });
  }

  recomputeAllInBackground(propertyId);
  invalidateKnowledgeInBackground(propertyId, "amenity", null);
  revalidatePath(`/properties/${propertyId}/amenities`);
  return { success: true };
}

export async function updateAmenityAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const amenityId = formData.get("amenityId") as string;
  if (!amenityId) return { success: false, error: "Falta el ID del amenity" };
  const instance = await prisma.propertyAmenityInstance.findUnique({
    where: { id: amenityId },
    select: { propertyId: true, amenityKey: true },
  });
  if (!instance) return { success: false, error: "Amenity no encontrado" };
  const formPropertyId = formData.get("propertyId") as string | null;
  if (!formPropertyId || formPropertyId !== instance.propertyId) {
    return { success: false, error: "El amenity no pertenece a la propiedad indicada" };
  }

  // Parse detailsJson from form (sent as JSON string)
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

  const result = updateAmenitySchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Subtype-specific validation: if the amenity declares a subtype, its
  // detailsJson fields must match the taxonomy-defined shape (types, enum
  // values, required-ness). Prevents a malicious/incorrect client from
  // persisting arbitrary structures that the UI wouldn't produce.
  const subtype = findSubtype(instance.amenityKey);
  if (subtype && result.data.detailsJson !== undefined) {
    const detailsResult = buildSubtypeDetailsSchema(subtype.fields).safeParse(
      result.data.detailsJson,
    );
    if (!detailsResult.success) {
      return {
        success: false,
        // Generic message so the panel surfaces *something* even when it
        // doesn't render fieldErrors (which it currently doesn't).
        error: "Hay errores en los campos del subtipo",
        fieldErrors: detailsResult.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    result.data.detailsJson = detailsResult.data as typeof result.data.detailsJson;
  }

  // Do not trust client-provided subtypeKey — derive it from the authoritative
  // amenityKey on the instance. Taxonomy maps amenity → subtype 1:1 keyed by
  // amenity_id, so if a subtype exists we force subtypeKey to that amenityKey;
  // otherwise we clear it.
  const {
    detailsJson: validatedDetails,
    subtypeKey: _clientSubtypeKey,
    ...rest
  } = result.data;
  const data: Prisma.PropertyAmenityInstanceUpdateInput = {
    ...rest,
    subtypeKey: subtype ? instance.amenityKey : null,
  };
  if (validatedDetails !== undefined) {
    data.detailsJson =
      Object.keys(validatedDetails).length > 0
        ? (validatedDetails as Prisma.InputJsonValue)
        : Prisma.DbNull;
  }

  await prisma.propertyAmenityInstance.update({
    where: { id: amenityId },
    data,
  });

  recomputeAllInBackground(instance.propertyId);
  invalidateKnowledgeInBackground(instance.propertyId, "amenity", amenityId);
  revalidatePath(`/properties/${instance.propertyId}/amenities`);
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
  if (!playbookId) return { success: false, error: "Falta el ID del playbook" };
  const playbook = await prisma.troubleshootingPlaybook.findUnique({
    where: { id: playbookId },
    select: { propertyId: true },
  });
  if (!playbook) return { success: false, error: "Playbook no encontrado" };
  const formPropertyId = formData.get("propertyId") as string | null;
  if (!formPropertyId || formPropertyId !== playbook.propertyId) {
    return { success: false, error: "El playbook no pertenece a la propiedad indicada" };
  }

  const raw = {
    title: formData.get("title") as string,
    severity: (formData.get("severity") as string) || undefined,
    symptomsMd: (formData.get("symptomsMd") as string) || undefined,
    guestStepsMd: (formData.get("guestStepsMd") as string) || undefined,
    internalStepsMd: (formData.get("internalStepsMd") as string) || undefined,
    escalationRule: (formData.get("escalationRule") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
    targetType: (formData.get("targetType") as string) || undefined,
    targetKey: (formData.get("targetKey") as string) || undefined,
  };

  const result = updatePlaybookSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { targetType, targetKey, ...rest } = result.data;

  // Only rewrite target columns when the caller explicitly sent targetType.
  // Omitting the field leaves existing links untouched; targetType="none" clears them.
  const targetUpdate =
    targetType === undefined
      ? {}
      : {
          systemKey: targetType === "system" ? (targetKey ?? null) : null,
          amenityKey: targetType === "amenity" ? (targetKey ?? null) : null,
          spaceId: targetType === "space" ? (targetKey ?? null) : null,
          accessMethodKey: targetType === "access" ? (targetKey ?? null) : null,
        };

  if ("spaceId" in targetUpdate && targetUpdate.spaceId) {
    const targetSpace = await prisma.space.findUnique({
      where: { id: targetUpdate.spaceId },
      select: { propertyId: true },
    });
    if (!targetSpace || targetSpace.propertyId !== playbook.propertyId) {
      return { success: false, error: "El espacio no pertenece a la propiedad" };
    }
  }

  await prisma.troubleshootingPlaybook.update({
    where: { id: playbookId },
    data: { ...rest, ...targetUpdate },
  });

  revalidatePath(`/properties/${playbook.propertyId}/troubleshooting`);
  return { success: true };
}

// ── Local Guide (S-18) ──

export async function createLocalPlaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  const latRaw = formData.get("latitude") as string | null;
  const lngRaw = formData.get("longitude") as string | null;
  const providerMetadataRaw = formData.get("providerMetadata") as string | null;

  let providerMetadata: unknown = undefined;
  if (providerMetadataRaw) {
    try {
      providerMetadata = JSON.parse(providerMetadataRaw);
    } catch {
      return {
        success: false,
        fieldErrors: { providerMetadata: ["JSON inválido"] },
      };
    }
  }

  const raw = {
    categoryKey: formData.get("categoryKey") as string,
    name: formData.get("name") as string,
    shortNote: (formData.get("shortNote") as string) || undefined,
    distanceMeters: formData.get("distanceMeters")
      ? Number(formData.get("distanceMeters"))
      : undefined,
    latitude: latRaw ? Number(latRaw) : undefined,
    longitude: lngRaw ? Number(lngRaw) : undefined,
    address: (formData.get("address") as string) || undefined,
    website: (formData.get("website") as string) || undefined,
    provider: (formData.get("provider") as string) || undefined,
    providerPlaceId: (formData.get("providerPlaceId") as string) || undefined,
    providerMetadata,
  };

  const result = createLocalPlaceSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { providerMetadata: pm, ...rest } = result.data;
  try {
    await prisma.localPlace.create({
      data: {
        ...rest,
        ...(pm !== undefined ? { providerMetadata: pm } : {}),
        property: { connect: { id: propertyId } },
      },
    });
  } catch (err) {
    // Unique index `(propertyId, provider, providerPlaceId)` collides when
    // the same POI is added twice (manual entries skip this — both NULL, and
    // Postgres treats NULLs as distinct). Surface a friendly message instead
    // of a 500. Other errors re-throw.
    if ((err as { code?: string }).code === "P2002") {
      return { success: false, error: "Este lugar ya está añadido" };
    }
    throw err;
  }

  revalidatePath(`/properties/${propertyId}/local-guide`);
  return { success: true };
}

export async function updateLocalPlaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const placeId = formData.get("placeId") as string;
  if (!placeId) return { success: false, error: "Falta el ID del lugar" };
  const place = await prisma.localPlace.findUnique({
    where: { id: placeId },
    select: { propertyId: true },
  });
  if (!place) return { success: false, error: "Lugar no encontrado" };
  const formPropertyId = formData.get("propertyId") as string | null;
  if (!formPropertyId || formPropertyId !== place.propertyId) {
    return { success: false, error: "El lugar no pertenece a la propiedad indicada" };
  }

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

  revalidatePath(`/properties/${place.propertyId}/local-guide`);
  return { success: true };
}

export async function deleteLocalPlaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const placeId = formData.get("placeId") as string;
  if (!placeId) return { success: false, error: "Falta el ID del lugar" };
  const place = await prisma.localPlace.findUnique({
    where: { id: placeId },
    select: { propertyId: true },
  });
  if (!place) return { success: false, error: "Lugar no encontrado" };
  const formPropertyId = formData.get("propertyId") as string | null;
  if (!formPropertyId || formPropertyId !== place.propertyId) {
    return { success: false, error: "El lugar no pertenece a la propiedad indicada" };
  }

  await prisma.localPlace.delete({ where: { id: placeId } });

  revalidatePath(`/properties/${place.propertyId}/local-guide`);
  return { success: true };
}

// ── Systems ──

export async function createSystemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) return { success: false, error: "Falta el ID de la propiedad" };
  const raw = { systemKey: formData.get("systemKey") as string };
  const result = createSystemSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const taxonomyItem = findSystemItem(result.data.systemKey);
  if (!taxonomyItem) return { success: false, error: "Sistema no reconocido en la taxonomía" };
  const defaultVisibility = normaliseVisibility(taxonomyItem.visibility);
  let createdSystemId: string;
  try {
    const created = await prisma.propertySystem.create({
      data: { propertyId, systemKey: result.data.systemKey, visibility: defaultVisibility },
      select: { id: true },
    });
    createdSystemId = created.id;
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return { success: false, error: "Este sistema ya está configurado en la propiedad" };
    }
    throw err;
  }
  recomputeAllInBackground(propertyId);
  invalidateKnowledgeInBackground(propertyId, "system", createdSystemId);
  revalidatePath(`/properties/${propertyId}/systems`);
  return { success: true };
}

export async function updateSystemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const systemId = formData.get("systemId") as string;
  if (!systemId) return { success: false, error: "Falta el ID del sistema" };
  const system = await prisma.propertySystem.findUnique({
    where: { id: systemId },
    select: { propertyId: true },
  });
  if (!system) return { success: false, error: "Sistema no encontrado" };

  const raw: Record<string, unknown> = {
    internalNotes: formData.has("internalNotes")
      ? ((formData.get("internalNotes") as string) || null)
      : undefined,
    visibility: (formData.get("visibility") as string) || undefined,
  };
  const detailsStr = formData.get("detailsJson") as string | null;
  const opsStr = formData.get("opsJson") as string | null;
  if (detailsStr) {
    try { raw.detailsJson = JSON.parse(detailsStr); } catch { return { success: false, error: "Datos de detalles inválidos" }; }
  }
  if (opsStr) {
    try { raw.opsJson = JSON.parse(opsStr); } catch { return { success: false, error: "Datos de operaciones inválidos" }; }
  }
  const result = updateSystemSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }
  await prisma.propertySystem.update({
    where: { id: systemId },
    data: {
      detailsJson: result.data.detailsJson ?? undefined,
      opsJson: result.data.opsJson ?? undefined,
      internalNotes: result.data.internalNotes,
      visibility: result.data.visibility,
    },
  });
  recomputeAllInBackground(system.propertyId);
  invalidateKnowledgeInBackground(system.propertyId, "system", systemId);
  revalidatePath(`/properties/${system.propertyId}/systems`);
  revalidatePath(`/properties/${system.propertyId}/systems/${systemId}`);
  return { success: true };
}

export async function deleteSystemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const systemId = formData.get("systemId") as string;
  if (!systemId) return { success: false, error: "Falta el ID del sistema" };
  const system = await prisma.propertySystem.findUnique({
    where: { id: systemId },
    select: { propertyId: true },
  });
  if (!system) return { success: false, error: "Sistema no encontrado" };

  await prisma.propertySystem.delete({ where: { id: systemId } });
  deleteEntityChunksInBackground(system.propertyId, "system", systemId);
  recomputeAllInBackground(system.propertyId);
  revalidatePath(`/properties/${system.propertyId}/systems`);
  revalidatePath(`/properties/${system.propertyId}/spaces`);
  return { success: true };
}

export async function updateSystemCoverageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const systemId = formData.get("systemId") as string;
  if (!systemId) return { success: false, error: "Falta el ID del sistema" };
  const raw = {
    spaceId: formData.get("spaceId") as string,
    mode: formData.get("mode") as string,
    note: (formData.get("note") as string) || null,
  };
  const result = updateSystemCoverageSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]> };
  }

  // Verify both system and space belong to the same property
  const [system, space] = await Promise.all([
    prisma.propertySystem.findUnique({ where: { id: systemId }, select: { propertyId: true } }),
    prisma.space.findUnique({ where: { id: result.data.spaceId }, select: { propertyId: true } }),
  ]);
  if (!system || !space || system.propertyId !== space.propertyId) {
    return { success: false, error: "Acceso denegado" };
  }

  if (result.data.mode === "inherited") {
    await prisma.propertySystemCoverage.deleteMany({
      where: { systemId, spaceId: result.data.spaceId },
    });
  } else {
    await prisma.propertySystemCoverage.upsert({
      where: { systemId_spaceId: { systemId, spaceId: result.data.spaceId } },
      create: { systemId, spaceId: result.data.spaceId, mode: result.data.mode, note: result.data.note },
      update: { mode: result.data.mode, note: result.data.note },
    });
  }
  recomputeAllInBackground(system.propertyId);
  revalidatePath(`/properties/${system.propertyId}/systems/${systemId}`);
  revalidatePath(`/properties/${system.propertyId}/spaces`);
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
