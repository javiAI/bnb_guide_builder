"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/require-operator";
import { applyOperatorRateLimit } from "@/lib/services/operator-rate-limit";
import {
  checkPlacesRateLimit,
  enforcePlacesBucketCap,
} from "@/lib/services/places/rate-limit";
import {
  PoiProviderConfigError,
  PoiProviderUnavailableError,
  ProviderMetadataSchema,
} from "@/lib/services/places";
import {
  discoverParkingSuggestions,
  type ParkingDiscoveryResult,
  type ParkingSuggestion,
} from "@/lib/services/parking-discovery.service";
import {
  AUDIT_ACTIONS,
  formatActor,
  writeAudit,
} from "@/lib/services/audit.service";
import { visibilityLevels } from "@/lib/visibility";
import { isPrismaUniqueViolation } from "@/lib/utils";
import type { ActionResult } from "@/lib/types/action-result";

// `lp.parking` is the spec contract for branch 16E.6 — pinning parking pins
// to a single category key keeps the query, dedupe and guest-leak invariants
// trivial. Same constant as `parking-discovery.service.ts`.
const PARKING_CATEGORY_KEY = "lp.parking";

// ── 1) Search nearby parkings ──
//
// `expensive` bucket per actor (10/60s) layered on top of a per-property
// limiter (30/60s, sliding window). The cascade catches both single-actor
// flooding and coordinated bursts targeting the same property.

export interface ParkingSearchResult {
  suggestions: ParkingSuggestion[];
  warningKey: ParkingDiscoveryResult["warningKey"];
  totalBeforeCap: number;
}

// Aliased here so the create-action signatures don't carry an inline
// `{ id: string }` literal, which would confuse the static walker in
// `audit-mutation-coverage.test.ts` (it extracts the function body by
// finding the first `{` after the close-paren of the params).
export interface ParkingPlaceCreated {
  id: string;
}

export async function searchNearbyParkingsAction(
  propertyId: string,
  language: "es" | "en" = "es",
): Promise<ActionResult<ParkingSearchResult>> {
  if (!propertyId) return { success: false, error: "Falta propertyId" };

  let operator;
  try {
    operator = await requireOperator();
  } catch {
    return { success: false, error: "Sesión requerida" };
  }

  const actorGate = applyOperatorRateLimit({
    userId: operator.userId,
    bucket: "expensive",
  });
  if (!actorGate.ok) {
    return {
      success: false,
      error: `Demasiadas peticiones. Reintenta en ${actorGate.retryAfterSeconds}s.`,
    };
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId, workspaceId: operator.workspaceId },
    select: { latitude: true, longitude: true },
  });
  if (!property) return { success: false, error: "Propiedad no encontrada" };
  if (property.latitude === null || property.longitude === null) {
    return { success: false, error: "La propiedad no tiene coordenadas" };
  }

  const now = Date.now();
  const propertyGate = checkPlacesRateLimit(`parking:${propertyId}`, now);
  enforcePlacesBucketCap(now);
  if (!propertyGate.allowed) {
    return {
      success: false,
      error: `Demasiadas peticiones. Reintenta en ${propertyGate.retryAfterSeconds}s.`,
    };
  }

  // Build exclude set from existing pins so the UI never sees a suggestion
  // already confirmed for this property.
  const existing = await prisma.localPlace.findMany({
    where: {
      propertyId,
      categoryKey: PARKING_CATEGORY_KEY,
      providerPlaceId: { not: null },
    },
    select: { providerPlaceId: true },
  });
  const excludeProviderPlaceIds: ReadonlySet<string> = new Set(
    existing
      .map((r) => r.providerPlaceId)
      .filter((id): id is string => id !== null),
  );

  try {
    const result = await discoverParkingSuggestions({
      anchor: { latitude: property.latitude, longitude: property.longitude },
      language,
      excludeProviderPlaceIds,
    });
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof PoiProviderConfigError) {
      return { success: false, error: "Proveedor de mapas no configurado" };
    }
    if (err instanceof PoiProviderUnavailableError) {
      console.error(
        `[parking-search] propertyId=${propertyId} provider unavailable:`,
        err.message,
      );
      return { success: false, error: "Proveedor de mapas no disponible" };
    }
    console.error(`[parking-search] propertyId=${propertyId} error:`, err);
    return { success: false, error: "Error inesperado" };
  }
}

// ── 2) Confirm provider suggestion ──
//
// The client passes back the full suggestion shape it received from the
// search action. Validation is strict: a tampered providerMetadata or an
// out-of-range lat/lng is rejected before hitting the DB.

const confirmParkingSchema = z
  .object({
    propertyId: z.string().min(1),
    provider: z.string().min(1),
    providerPlaceId: z.string().min(1),
    name: z.string().min(1),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    address: z.string().nullable(),
    website: z.string().url().nullable(),
    distanceMeters: z.number().int().min(0),
    providerMetadata: ProviderMetadataSchema,
  })
  .strict();

export type ConfirmParkingInput = z.infer<typeof confirmParkingSchema>;

export async function confirmParkingPlaceAction(
  input: ConfirmParkingInput,
): Promise<ActionResult<ParkingPlaceCreated>> {
  const parsed = confirmParkingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  let operator;
  try {
    operator = await requireOperator();
  } catch {
    return { success: false, error: "Sesión requerida" };
  }

  const actorGate = applyOperatorRateLimit({
    userId: operator.userId,
    bucket: "mutate",
  });
  if (!actorGate.ok) {
    return {
      success: false,
      error: `Demasiadas peticiones. Reintenta en ${actorGate.retryAfterSeconds}s.`,
    };
  }

  const property = await prisma.property.findUnique({
    where: { id: parsed.data.propertyId, workspaceId: operator.workspaceId },
    select: { id: true },
  });
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  let createdId: string;
  try {
    const created = await prisma.localPlace.create({
      data: {
        propertyId: parsed.data.propertyId,
        categoryKey: PARKING_CATEGORY_KEY,
        name: parsed.data.name,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        address: parsed.data.address,
        website: parsed.data.website,
        distanceMeters: parsed.data.distanceMeters,
        provider: parsed.data.provider,
        providerPlaceId: parsed.data.providerPlaceId,
        providerMetadata: parsed.data.providerMetadata,
        visibility: "guest",
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return { success: false, error: "Este parking ya está añadido" };
    }
    throw err;
  }

  await writeAudit({
    propertyId: parsed.data.propertyId,
    actor: formatActor({ type: "user", userId: operator.userId }),
    entityType: "LocalPlace",
    entityId: createdId,
    action: AUDIT_ACTIONS.create,
    diff: {
      categoryKey: PARKING_CATEGORY_KEY,
      name: parsed.data.name,
      provider: parsed.data.provider,
      providerPlaceId: parsed.data.providerPlaceId,
      visibility: "guest",
      source: "provider-suggestion",
    },
  });

  revalidatePath(`/properties/${parsed.data.propertyId}/access`);
  return { success: true, data: { id: createdId } };
}

// ── 3) Add manual parking pin (no provider) ──

const manualParkingSchema = z
  .object({
    propertyId: z.string().min(1),
    name: z.string().min(1, "El nombre es obligatorio"),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    address: z.string().nullable().optional(),
    shortNote: z.string().nullable().optional(),
  })
  .strict();

export type ManualParkingInput = z.infer<typeof manualParkingSchema>;

export async function addManualParkingPlaceAction(
  input: ManualParkingInput,
): Promise<ActionResult<ParkingPlaceCreated>> {
  const parsed = manualParkingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  let operator;
  try {
    operator = await requireOperator();
  } catch {
    return { success: false, error: "Sesión requerida" };
  }

  const actorGate = applyOperatorRateLimit({
    userId: operator.userId,
    bucket: "mutate",
  });
  if (!actorGate.ok) {
    return {
      success: false,
      error: `Demasiadas peticiones. Reintenta en ${actorGate.retryAfterSeconds}s.`,
    };
  }

  const property = await prisma.property.findUnique({
    where: { id: parsed.data.propertyId, workspaceId: operator.workspaceId },
    select: { id: true },
  });
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  const created = await prisma.localPlace.create({
    data: {
      propertyId: parsed.data.propertyId,
      categoryKey: PARKING_CATEGORY_KEY,
      name: parsed.data.name,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      address: parsed.data.address ?? null,
      shortNote: parsed.data.shortNote ?? null,
      visibility: "guest",
    },
    select: { id: true },
  });

  await writeAudit({
    propertyId: parsed.data.propertyId,
    actor: formatActor({ type: "user", userId: operator.userId }),
    entityType: "LocalPlace",
    entityId: created.id,
    action: AUDIT_ACTIONS.create,
    diff: {
      categoryKey: PARKING_CATEGORY_KEY,
      name: parsed.data.name,
      visibility: "guest",
      source: "manual",
    },
  });

  revalidatePath(`/properties/${parsed.data.propertyId}/access`);
  return { success: true, data: { id: created.id } };
}

// ── 4) Update an existing parking pin ──
//
// Editable surface intentionally narrow: name (label visible al huésped),
// shortNote (nota corta), visibility (toggle guest/internal). Coordinates,
// provider, address and website stay immutable — re-confirming or
// re-creating is the path for those.

const updateParkingSchema = z
  .object({
    placeId: z.string().min(1),
    name: z.string().min(1).optional(),
    shortNote: z.string().nullable().optional(),
    visibility: z.enum(visibilityLevels).optional(),
  })
  .strict();

export type UpdateParkingInput = z.infer<typeof updateParkingSchema>;

export async function updateParkingPlaceAction(
  input: UpdateParkingInput,
): Promise<ActionResult> {
  const parsed = updateParkingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  let operator;
  try {
    operator = await requireOperator();
  } catch {
    return { success: false, error: "Sesión requerida" };
  }

  const actorGate = applyOperatorRateLimit({
    userId: operator.userId,
    bucket: "mutate",
  });
  if (!actorGate.ok) {
    return {
      success: false,
      error: `Demasiadas peticiones. Reintenta en ${actorGate.retryAfterSeconds}s.`,
    };
  }

  const place = await prisma.localPlace.findFirst({
    where: {
      id: parsed.data.placeId,
      categoryKey: PARKING_CATEGORY_KEY,
      property: { workspaceId: operator.workspaceId },
    },
    select: { id: true, propertyId: true, name: true, visibility: true },
  });
  if (!place) return { success: false, error: "Pin no encontrado" };

  const data: { name?: string; shortNote?: string | null; visibility?: (typeof visibilityLevels)[number] } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.shortNote !== undefined) data.shortNote = parsed.data.shortNote;
  if (parsed.data.visibility !== undefined) data.visibility = parsed.data.visibility;
  if (Object.keys(data).length === 0) return { success: true };

  await prisma.localPlace.update({
    where: { id: place.id },
    data,
  });

  await writeAudit({
    propertyId: place.propertyId,
    actor: formatActor({ type: "user", userId: operator.userId }),
    entityType: "LocalPlace",
    entityId: place.id,
    action: AUDIT_ACTIONS.update,
    diff: data,
  });

  revalidatePath(`/properties/${place.propertyId}/access`);
  return { success: true };
}

// ── 5) Delete a parking pin ──
//
// Idempotent: deleting a row that does not exist (or was never owned by the
// caller's workspace) returns success silently — this matches the UI flow
// where a stale list item gets clicked twice.

const deleteParkingSchema = z
  .object({
    placeId: z.string().min(1),
  })
  .strict();

export type DeleteParkingInput = z.infer<typeof deleteParkingSchema>;

export async function deleteParkingPlaceAction(
  input: DeleteParkingInput,
): Promise<ActionResult> {
  const parsed = deleteParkingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  let operator;
  try {
    operator = await requireOperator();
  } catch {
    return { success: false, error: "Sesión requerida" };
  }

  const actorGate = applyOperatorRateLimit({
    userId: operator.userId,
    bucket: "mutate",
  });
  if (!actorGate.ok) {
    return {
      success: false,
      error: `Demasiadas peticiones. Reintenta en ${actorGate.retryAfterSeconds}s.`,
    };
  }

  const place = await prisma.localPlace.findFirst({
    where: {
      id: parsed.data.placeId,
      categoryKey: PARKING_CATEGORY_KEY,
      property: { workspaceId: operator.workspaceId },
    },
    select: { id: true, propertyId: true, name: true },
  });
  if (!place) return { success: true };

  await prisma.localPlace.delete({ where: { id: place.id } });

  await writeAudit({
    propertyId: place.propertyId,
    actor: formatActor({ type: "user", userId: operator.userId }),
    entityType: "LocalPlace",
    entityId: place.id,
    action: AUDIT_ACTIONS.delete,
    diff: { name: place.name },
  });

  revalidatePath(`/properties/${place.propertyId}/access`);
  return { success: true };
}
