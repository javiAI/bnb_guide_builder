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
  type ProviderMetadata,
  ProviderMetadataSchema,
  resolveLocalPoiProvider,
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

/** Merge a `feeType` change into an existing `providerMetadata` JSON value
 * (or synthesize a fresh metadata blob for manual rows that never had one).
 * Keeps the shape compatible with `ProviderMetadataSchema` so a future re-read
 * + parse round-trips cleanly. */
function mergeFeeTypeIntoMetadata(
  existing: unknown,
  feeType: "free" | "paid" | null,
): ProviderMetadata {
  const base: ProviderMetadata =
    existing && typeof existing === "object"
      ? {
          nativeCategory:
            (existing as { nativeCategory?: string | null }).nativeCategory ?? null,
          placeTypes: Array.isArray(
            (existing as { placeTypes?: unknown }).placeTypes,
          )
            ? ((existing as { placeTypes: unknown[] }).placeTypes.filter(
                (t) => typeof t === "string",
              ) as string[])
            : [],
          confidence:
            typeof (existing as { confidence?: number | null }).confidence ===
            "number"
              ? (existing as { confidence: number }).confidence
              : null,
          retrievedAt:
            typeof (existing as { retrievedAt?: string }).retrievedAt === "string"
              ? (existing as { retrievedAt: string }).retrievedAt
              : new Date().toISOString(),
        }
      : {
          nativeCategory: null,
          placeTypes: [],
          confidence: null,
          retrievedAt: new Date().toISOString(),
        };
  return { ...base, feeType };
}

// First-pin convenience: when the operator confirms / adds the very first
// parking pin and `parkingMapInCover` is still off, flip it on so the
// freshly-saved pin is visible in the cockpit cover without a second click.
// `existingCount === 0` is captured BEFORE the create, so the bulk-action
// case (N pins in one charge) treats them all as part of the same first save.
interface AutoEnableCoverHint {
  property: { id: string; parkingMapInCover: boolean } | null;
  shouldAutoEnable: boolean;
}

async function loadPropertyAndAutoEnableHint(
  propertyId: string,
  operator: { workspaceId: string },
): Promise<AutoEnableCoverHint> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId, workspaceId: operator.workspaceId },
    select: { id: true, parkingMapInCover: true },
  });
  if (!property) return { property: null, shouldAutoEnable: false };
  if (property.parkingMapInCover) return { property, shouldAutoEnable: false };
  const existingCount = await prisma.localPlace.count({
    where: { propertyId, categoryKey: PARKING_CATEGORY_KEY },
  });
  return { property, shouldAutoEnable: existingCount === 0 };
}

async function autoEnableCoverIfNeeded(
  shouldAutoEnable: boolean,
  property: { id: string },
  propertyId: string,
  userId: string,
): Promise<void> {
  if (!shouldAutoEnable) return;
  await prisma.property.update({
    where: { id: property.id },
    data: { parkingMapInCover: true },
  });
  await writeAudit({
    propertyId,
    actor: formatActor({ type: "user", userId }),
    entityType: "Property",
    entityId: property.id,
    action: AUDIT_ACTIONS.update,
    diff: { parkingMapInCover: true, autoEnabled: true },
  });
}

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

// ── 1.b) Reverse-geocode at a coordinate ──
//
// Used by the manual-pin form to autofill name/address when the operator
// drops a pin on the map. Returns `null` (success, no match) when the
// upstream provider has no POI near the click. `expensive` bucket per
// actor; no per-property limiter — clicks on the map are bounded by the
// UI debounce, not by burst risk.

export interface ReverseGeocodeForParkingResult {
  /** `null` when the provider returned zero features near the coordinate. */
  match: {
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    /** True when the closest feature mapped to `lp.parking`; lets the UI
     * hint "POI cercano: parking" vs a generic POI fallback. */
    isParking: boolean;
  } | null;
}

const reverseGeocodeSchema = z
  .object({
    propertyId: z.string().min(1),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    language: z.enum(["es", "en"]).optional(),
  })
  .strict();

export type ReverseGeocodeForParkingInput = z.infer<
  typeof reverseGeocodeSchema
>;

export async function reverseGeocodeForParkingAction(
  input: ReverseGeocodeForParkingInput,
): Promise<ActionResult<ReverseGeocodeForParkingResult>> {
  const parsed = reverseGeocodeSchema.safeParse(input);
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
    bucket: "expensive",
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

  const provider = resolveLocalPoiProvider();
  if (typeof provider.reverse !== "function") {
    return { success: true, data: { match: null } };
  }

  try {
    const hit = await provider.reverse({
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      language: parsed.data.language ?? "es",
      preferCategoryKey: PARKING_CATEGORY_KEY,
    });
    if (!hit) return { success: true, data: { match: null } };
    return {
      success: true,
      data: {
        match: {
          name: hit.name,
          address: hit.address ?? null,
          latitude: hit.latitude,
          longitude: hit.longitude,
          isParking: hit.categoryKey === PARKING_CATEGORY_KEY,
        },
      },
    };
  } catch (err) {
    if (err instanceof PoiProviderConfigError) {
      return { success: false, error: "Proveedor de mapas no configurado" };
    }
    if (err instanceof PoiProviderUnavailableError) {
      console.error(
        `[parking-reverse] propertyId=${parsed.data.propertyId} provider unavailable:`,
        err.message,
      );
      return { success: false, error: "Proveedor de mapas no disponible" };
    }
    console.error(
      `[parking-reverse] propertyId=${parsed.data.propertyId} error:`,
      err,
    );
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

  const { property, shouldAutoEnable } = await loadPropertyAndAutoEnableHint(
    parsed.data.propertyId,
    operator,
  );
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

  await autoEnableCoverIfNeeded(
    shouldAutoEnable,
    property,
    parsed.data.propertyId,
    operator.userId,
  );

  revalidatePath(`/properties/${parsed.data.propertyId}/access`);
  return { success: true, data: { id: createdId } };
}

// ── 2.b) Bulk confirm provider suggestions ──
//
// Operator clicks "Guardar N seleccionados" with N items checked. We
// run them in a single mutate-bucket charge (one user-intent, not N),
// dedupe per-row via the same P2002 swallow as the single action, and
// audit each successful create individually so the audit log mirrors
// what would have happened if the operator had clicked Confirmar N
// times.

const confirmParkingBulkSchema = z
  .object({
    items: z.array(confirmParkingSchema).min(1).max(20),
  })
  .strict();

export type ConfirmParkingBulkInput = z.infer<typeof confirmParkingBulkSchema>;

export interface ConfirmParkingBulkResult {
  created: string[];
  /** providerPlaceIds that were silently skipped because the row already
   * existed (P2002). Lets the UI prune them from the suggestions list. */
  skippedProviderPlaceIds: string[];
}

export async function confirmParkingPlacesBulkAction(
  input: ConfirmParkingBulkInput,
): Promise<ActionResult<ConfirmParkingBulkResult>> {
  const parsed = confirmParkingBulkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const propertyIds = new Set(parsed.data.items.map((i) => i.propertyId));
  if (propertyIds.size !== 1) {
    return { success: false, error: "Todos los items deben pertenecer a la misma propiedad" };
  }
  const propertyId = parsed.data.items[0].propertyId;

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

  const { property, shouldAutoEnable } = await loadPropertyAndAutoEnableHint(
    propertyId,
    operator,
  );
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  const created: string[] = [];
  const skipped: string[] = [];
  for (const item of parsed.data.items) {
    try {
      const row = await prisma.localPlace.create({
        data: {
          propertyId: item.propertyId,
          categoryKey: PARKING_CATEGORY_KEY,
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          address: item.address,
          website: item.website,
          distanceMeters: item.distanceMeters,
          provider: item.provider,
          providerPlaceId: item.providerPlaceId,
          providerMetadata: item.providerMetadata,
          visibility: "guest",
        },
        select: { id: true },
      });
      created.push(row.id);
      await writeAudit({
        propertyId,
        actor: formatActor({ type: "user", userId: operator.userId }),
        entityType: "LocalPlace",
        entityId: row.id,
        action: AUDIT_ACTIONS.create,
        diff: {
          categoryKey: PARKING_CATEGORY_KEY,
          name: item.name,
          provider: item.provider,
          providerPlaceId: item.providerPlaceId,
          visibility: "guest",
          source: "provider-suggestion-bulk",
        },
      });
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        skipped.push(item.providerPlaceId);
        continue;
      }
      throw err;
    }
  }

  if (created.length > 0) {
    await autoEnableCoverIfNeeded(
      shouldAutoEnable,
      property,
      propertyId,
      operator.userId,
    );
    revalidatePath(`/properties/${propertyId}/access`);
  }
  return {
    success: true,
    data: { created, skippedProviderPlaceIds: skipped },
  };
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
    feeType: z.enum(["free", "paid"]).nullable().optional(),
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

  const { property, shouldAutoEnable } = await loadPropertyAndAutoEnableHint(
    parsed.data.propertyId,
    operator,
  );
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  // Only synthesize a metadata blob when the operator picked a concrete fee
  // type — `null` / `undefined` mean "unspecified" and we keep the JSON column
  // empty so the absence of metadata is the canonical "not classified" signal.
  const providerMetadata =
    parsed.data.feeType === "free" || parsed.data.feeType === "paid"
      ? {
          nativeCategory: null,
          placeTypes: [],
          confidence: null,
          retrievedAt: new Date().toISOString(),
          feeType: parsed.data.feeType,
        }
      : null;

  const created = await prisma.localPlace.create({
    data: {
      propertyId: parsed.data.propertyId,
      categoryKey: PARKING_CATEGORY_KEY,
      name: parsed.data.name,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      address: parsed.data.address ?? null,
      shortNote: parsed.data.shortNote ?? null,
      providerMetadata: providerMetadata ?? undefined,
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
      feeType: parsed.data.feeType ?? null,
      visibility: "guest",
      source: "manual",
    },
  });

  await autoEnableCoverIfNeeded(
    shouldAutoEnable,
    property,
    parsed.data.propertyId,
    operator.userId,
  );

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
    feeType: z.enum(["free", "paid"]).nullable().optional(),
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
    select: {
      id: true,
      propertyId: true,
      name: true,
      visibility: true,
      providerMetadata: true,
    },
  });
  if (!place) return { success: false, error: "Pin no encontrado" };

  const data: {
    name?: string;
    shortNote?: string | null;
    visibility?: (typeof visibilityLevels)[number];
    providerMetadata?: ReturnType<typeof mergeFeeTypeIntoMetadata>;
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.shortNote !== undefined) data.shortNote = parsed.data.shortNote;
  if (parsed.data.visibility !== undefined) data.visibility = parsed.data.visibility;
  if (parsed.data.feeType !== undefined) {
    data.providerMetadata = mergeFeeTypeIntoMetadata(
      place.providerMetadata,
      parsed.data.feeType,
    );
  }
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
    diff: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.shortNote !== undefined
        ? { shortNote: parsed.data.shortNote }
        : {}),
      ...(parsed.data.visibility !== undefined
        ? { visibility: parsed.data.visibility }
        : {}),
      ...(parsed.data.feeType !== undefined ? { feeType: parsed.data.feeType } : {}),
    },
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

// ── 6) Toggle "use parking map as cockpit cover" ──
//
// Persists the operator preference on `Property.parkingMapInCover`. When true
// AND ≥1 confirmed parking pin exists, `page.tsx` injects a synthetic map
// slide into the parking subsystem carousel that the cockpit card renders as
// an interactive `<MultiPinMap>` instead of an `<img>`.

const setParkingMapInCoverSchema = z
  .object({
    propertyId: z.string().min(1),
    enabled: z.boolean(),
  })
  .strict();

export type SetParkingMapInCoverInput = z.infer<typeof setParkingMapInCoverSchema>;

export async function setParkingMapInCoverAction(
  input: SetParkingMapInCoverInput,
): Promise<ActionResult> {
  const parsed = setParkingMapInCoverSchema.safeParse(input);
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
    select: { id: true, parkingMapInCover: true },
  });
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  if (property.parkingMapInCover === parsed.data.enabled) return { success: true };

  await prisma.property.update({
    where: { id: property.id },
    data: { parkingMapInCover: parsed.data.enabled },
  });

  await writeAudit({
    propertyId: property.id,
    actor: formatActor({ type: "user", userId: operator.userId }),
    entityType: "Property",
    entityId: property.id,
    action: AUDIT_ACTIONS.update,
    diff: { parkingMapInCover: parsed.data.enabled },
  });

  revalidatePath(`/properties/${property.id}/access`);
  return { success: true };
}
