"use server";

import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  fullWizardSchema,
} from "@/lib/schemas/wizard.schema";
import { SPACE_TYPE_LABELS, CHILDREN_AGE_LIMIT, getAvailableSpaceTypes, getSpaceTypeLabel, LAYOUT_SPACE_MAP } from "@/lib/taxonomy-loader";
import { recomputePropertyCounts } from "@/lib/property-counts";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ── Helpers ──

async function ensureWorkspace(): Promise<string> {
  let workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: "Mi workspace" },
    });
  }
  return workspace.id;
}

async function getSessionState(sessionId: string): Promise<Record<string, unknown>> {
  const session = await prisma.wizardSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { stateJson: true },
  });
  return (session.stateJson as Record<string, unknown>) ?? {};
}

async function mergeSessionState(
  sessionId: string,
  data: Record<string, unknown>,
  nextStep: number,
): Promise<void> {
  const current = await getSessionState(sessionId);
  const merged = { ...current, ...data };
  await prisma.wizardSession.update({
    where: { id: sessionId },
    data: {
      stateJson: merged as object,
      currentStep: nextStep,
    },
  });
}

async function handleSaveAndExit(
  formData: FormData,
  sessionId: string,
  raw: Record<string, unknown>,
  defaultStep: number,
): Promise<boolean> {
  if (!formData.get("_saveAndExit")) return false;
  const partial: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) { if (v != null && v !== "") partial[k] = v; }
  await mergeSessionState(sessionId, partial, Number(formData.get("_currentStep") || defaultStep));
  redirect("/");
}

// ── Duplicate name check (checks both properties and draft sessions) ──

export async function checkDuplicateNameAction(
  nickname: string,
): Promise<{ duplicate: boolean }> {
  const workspaceId = await ensureWorkspace();
  const trimmed = nickname.trim();
  const [existingProperty, existingDraft] = await Promise.all([
    prisma.property.findFirst({
      where: { workspaceId, propertyNickname: trimmed },
      select: { id: true },
    }),
    prisma.wizardSession.findFirst({
      where: { workspaceId, propertyNickname: trimmed, status: "in_progress", propertyId: null },
      select: { id: true },
    }),
  ]);
  return { duplicate: !!(existingProperty || existingDraft) };
}

// ── Restore snapshot (for cancel) ──

export async function restoreSnapshotAction(
  sessionId: string,
  snapshot: Record<string, unknown>,
  originalStep: number,
): Promise<void> {
  await prisma.wizardSession.update({
    where: { id: sessionId },
    data: {
      stateJson: snapshot as object,
      currentStep: originalStep,
    },
  });
}

// ── Delete draft from dashboard ──

export async function deleteDraftAction(
  _prev: { success: boolean } | null,
  formData: FormData,
): Promise<{ success: boolean }> {
  const sessionId = formData.get("sessionId") as string;
  if (!sessionId) return { success: false };
  try {
    await prisma.wizardSession.deleteMany({ where: { id: sessionId } });
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/");
    return { success: true };
  } catch {
    return { success: false };
  }
}

// ── Welcome: start wizard session (no property created) ──

export async function startWizardAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const nickname = formData.get("propertyNickname") as string;
  if (!nickname || nickname.trim().length === 0) {
    return { success: false, error: "El nombre es obligatorio" };
  }

  const existingSessionId = formData.get("sessionId") as string | null;

  // If returning to welcome with an existing session, update the nickname
  if (existingSessionId) {
    await prisma.wizardSession.update({
      where: { id: existingSessionId },
      data: { propertyNickname: nickname.trim() },
    });
    redirect(`/properties/new/step-1?sessionId=${existingSessionId}`);
  }

  const workspaceId = await ensureWorkspace();

  const session = await prisma.wizardSession.create({
    data: {
      workspace: { connect: { id: workspaceId } },
      propertyNickname: nickname.trim(),
      status: "in_progress",
      currentStep: 1,
      stateJson: {},
    },
  });

  redirect(`/properties/new/step-1?sessionId=${session.id}`);
}

// ── Step 1: property type + room type ──

export async function saveStep1Action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessionId = formData.get("sessionId") as string;
  const raw = {
    propertyType: formData.get("propertyType") as string,
    roomType: formData.get("roomType") as string,
    layoutKey: (formData.get("layoutKey") as string) || undefined,
    customPropertyTypeLabel: (formData.get("customPropertyTypeLabel") as string) || undefined,
    customPropertyTypeDesc: (formData.get("customPropertyTypeDesc") as string) || undefined,
    customRoomTypeLabel: (formData.get("customRoomTypeLabel") as string) || undefined,
    customRoomTypeDesc: (formData.get("customRoomTypeDesc") as string) || undefined,
  };

  await handleSaveAndExit(formData, sessionId, raw, 1);

  const result = step1Schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await mergeSessionState(sessionId, result.data, 2);
  redirect(`/properties/new/step-2?sessionId=${sessionId}`);
}

// ── Step 2: location ──

export async function saveStep2Action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessionId = formData.get("sessionId") as string;
  const raw = {
    country: formData.get("country") as string,
    city: formData.get("city") as string,
    region: (formData.get("region") as string) || null,
    postalCode: (formData.get("postalCode") as string) || null,
    streetAddress: formData.get("streetAddress") as string,
    addressExtra: (formData.get("addressExtra") as string) || null,
    addressLevel: (formData.get("addressLevel") as string) || undefined,
    timezone: formData.get("timezone") as string,
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
  };

  await handleSaveAndExit(formData, sessionId, raw, 2);

  const result = step2Schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await mergeSessionState(sessionId, result.data, 3);
  redirect(`/properties/new/step-3?sessionId=${sessionId}`);
}

// ── Step 3: capacity + beds ──

export async function saveStep3Action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessionId = formData.get("sessionId") as string;
  const bedsRaw = formData.get("beds") as string;
  let beds: Array<{ spaceIndex: number; spaceType: string; spaceLabel?: string; bedType: string; quantity: number }> = [];
  try {
    if (bedsRaw) beds = JSON.parse(bedsRaw);
  } catch { /* ignore */ }

  const raw = {
    maxGuests: Number(formData.get("maxGuests")),
    maxAdults: Number(formData.get("maxAdults")),
    maxChildren: Number(formData.get("maxChildren")),
    infantsAllowed: formData.get("infantsAllowed") === "on",
    bedroomsCount: Number(formData.get("bedroomsCount")),
    bathroomsCount: Number(formData.get("bathroomsCount")),
    beds,
  };

  await handleSaveAndExit(formData, sessionId, raw as Record<string, unknown>, 3);

  const result = step3Schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await mergeSessionState(sessionId, result.data, 4);
  redirect(`/properties/new/step-4?sessionId=${sessionId}`);
}

// ── Step 4: arrival ──

export async function saveStep4Action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessionId = formData.get("sessionId") as string;
  const hasBuildingAccess = formData.get("hasBuildingAccess") === "true";

  const buildingMethods = formData.getAll("buildingMethods") as string[];
  const unitMethods = formData.getAll("unitMethods") as string[];

  const autonomousRaw = formData.get("isAutonomousCheckin") as string;
  const buildingRaw = formData.get("hasBuildingAccess") as string;
  const isAutonomousCheckin = autonomousRaw === "" ? undefined : autonomousRaw === "true";
  const hasBuildingAccessParsed = buildingRaw === "" ? undefined : buildingRaw === "true";
  const isSaveAndExit = !!formData.get("_saveAndExit");

  const raw = {
    checkInStart: formData.get("checkInStart") as string,
    checkInEnd: formData.get("checkInEnd") as string,
    checkOutTime: formData.get("checkOutTime") as string,
    isAutonomousCheckin: isSaveAndExit ? isAutonomousCheckin : (isAutonomousCheckin ?? false),
    hasBuildingAccess: isSaveAndExit ? hasBuildingAccessParsed : (hasBuildingAccessParsed ?? false),
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
    hostName: (formData.get("hostName") as string) || undefined,
    hostContactPhone: (formData.get("hostContactPhone") as string) || undefined,
    wifiSsid: (formData.get("wifiSsid") as string) || undefined,
    wifiPassword: (formData.get("wifiPassword") as string) || undefined,
  };

  await handleSaveAndExit(formData, sessionId, raw as Record<string, unknown>, 4);

  const result = step4Schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await mergeSessionState(sessionId, result.data, 5);
  redirect(`/properties/new/review?sessionId=${sessionId}`);
}

// ── Review: complete wizard and create property ──

export async function completeWizardAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessionId = formData.get("sessionId") as string;

  const session = await prisma.wizardSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { workspaceId: true, propertyNickname: true, stateJson: true },
  });

  const state = (session.stateJson as Record<string, unknown>) ?? {};
  const fullState = {
    propertyNickname: session.propertyNickname,
    ...state,
  };

  const result = fullWizardSchema.safeParse(fullState);
  if (!result.success) {
    return { success: false, error: "Faltan datos obligatorios. Revisa todos los pasos." };
  }

  const d = result.data;

  // Check for duplicate name
  const existing = await prisma.property.findFirst({
    where: { workspaceId: session.workspaceId, propertyNickname: d.propertyNickname },
    select: { id: true },
  });
  if (existing) {
    return { success: false, error: "Ya existe una propiedad con ese nombre" };
  }

  // Create property + spaces + beds in transaction
  const property = await prisma.$transaction(async (tx) => {
    const prop = await tx.property.create({
      data: {
        workspace: { connect: { id: session.workspaceId } },
        propertyNickname: d.propertyNickname,
        propertyType: d.propertyType,
        roomType: d.roomType,
        layoutKey: d.layoutKey,
        customPropertyTypeLabel: d.customPropertyTypeLabel,
        customPropertyTypeDesc: d.customPropertyTypeDesc,
        customRoomTypeLabel: d.customRoomTypeLabel,
        customRoomTypeDesc: d.customRoomTypeDesc,
        country: d.country,
        city: d.city,
        region: d.region,
        postalCode: d.postalCode,
        streetAddress: d.streetAddress,
        addressExtra: d.addressExtra,
        addressLevel: d.addressLevel,
        timezone: d.timezone,
        latitude: d.latitude,
        longitude: d.longitude,
        maxGuests: d.maxGuests,
        maxAdults: d.maxAdults,
        maxChildren: d.maxChildren,
        childrenAgeLimit: CHILDREN_AGE_LIMIT,
        bedroomsCount: d.bedroomsCount,
        bedsCount: (d.beds ?? []).reduce((sum, b) => sum + b.quantity, 0),
        bathroomsCount: d.bathroomsCount,
        checkInStart: d.checkInStart,
        checkInEnd: d.checkInEnd,
        checkOutTime: d.checkOutTime,
        primaryAccessMethod: d.unitAccess.methods[0] ?? null,
        accessMethodsJson: {
          building: d.buildingAccess ?? null,
          unit: d.unitAccess,
        },
        customAccessMethodLabel: d.unitAccess.customLabel,
        customAccessMethodDesc: d.unitAccess.customDesc,
        infantsAllowed: d.infantsAllowed ?? false,
        isAutonomousCheckin: d.isAutonomousCheckin,
        hasBuildingAccess: d.hasBuildingAccess,
        status: "active",
      },
    });

    // Create host contact if name or phone provided
    if (d.hostName || d.hostContactPhone) {
      await tx.contact.create({
        data: {
          propertyId: prop.id,
          roleKey: "ct.host",
          entityType: "person",
          displayName: d.hostName?.trim() || "Anfitrión",
          phone: d.hostContactPhone,
          visibility: "guest",
          isPrimary: true,
        },
      });
    }

    // Create spaces with bed configurations (tagged with _origin for idempotent future upserts)
    let sortOrder = 0;
    if (d.beds && d.beds.length > 0) {
      // Group beds by spaceIndex
      const spaceMap = new Map<number, typeof d.beds>();
      for (const bed of d.beds) {
        const existing = spaceMap.get(bed.spaceIndex) ?? [];
        existing.push(bed);
        spaceMap.set(bed.spaceIndex, existing);
      }

      for (const [spaceIdx, spaceBeds] of spaceMap) {
        const first = spaceBeds[0];
        const spaceType = first.spaceType ?? "sp.bedroom";
        const isBedroom = spaceType === "sp.bedroom";
        const label = SPACE_TYPE_LABELS[spaceType] ?? "Zona";
        const name = isBedroom
          ? `Dormitorio ${spaceIdx + 1}`
          : first.spaceLabel ?? label;

        const space = await tx.space.create({
          data: {
            propertyId: prop.id,
            spaceType,
            name,
            sortOrder: sortOrder++,
            featuresJson: { _origin: { source: "wizard", key: `bed_space_${spaceIdx}` } },
          },
        });
        for (const bed of spaceBeds) {
          await tx.bedConfiguration.create({
            data: {
              spaceId: space.id,
              bedType: bed.bedType,
              quantity: bed.quantity,
            },
          });
        }
      }
    }

    // Create layout-derived spaces (non-bedroom spaces implied by layoutKey)
    const layoutSpaceType = d.layoutKey ? LAYOUT_SPACE_MAP[d.layoutKey] : undefined;
    if (layoutSpaceType) {
      await tx.space.create({
        data: {
          propertyId: prop.id,
          spaceType: layoutSpaceType,
          name: getSpaceTypeLabel(layoutSpaceType),
          sortOrder: sortOrder++,
          featuresJson: { _origin: { source: "wizard", key: `layout_${d.layoutKey}` } },
        },
      });
    }

    // Create bathroom space derived from bathroomsCount
    const bathroomsCount = d.bathroomsCount ?? 0;
    for (let i = 0; i < bathroomsCount; i++) {
      await tx.space.create({
        data: {
          propertyId: prop.id,
          spaceType: "sp.bathroom",
          name: bathroomsCount === 1 ? "Baño" : `Baño ${i + 1}`,
          sortOrder: sortOrder++,
          featuresJson: { _origin: { source: "wizard", key: `bathroom_${i}` } },
        },
      });
    }

    // Create wifi amenity if SSID provided
    if (d.wifiSsid) {
      await tx.propertyAmenity.create({
        data: {
          propertyId: prop.id,
          amenityKey: "am.wifi",
          guestInstructions: [
            d.wifiSsid ? `Red: ${d.wifiSsid}` : null,
            d.wifiPassword ? `Contraseña: ${d.wifiPassword}` : null,
          ].filter(Boolean).join("\n") || null,
          visibility: "public",
        },
      });
    }

    // Recompute derived counts from actual Space/Bed rows (overrides wizard form values)
    await recomputePropertyCounts(tx, prop.id);

    // Link session to property
    await tx.wizardSession.update({
      where: { id: sessionId },
      data: {
        propertyId: prop.id,
        status: "completed",
        completedAt: new Date(),
      },
    });

    return prop;
  });

  redirect(`/properties/${property.id}`);
}
