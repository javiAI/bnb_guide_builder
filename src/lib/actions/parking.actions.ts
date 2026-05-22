"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  PoiProviderConfigError,
  PoiProviderUnavailableError,
  type ProviderMetadata,
  ProviderMetadataSchema,
  haversineMeters,
  resolveLocalPoiProvider,
} from "@/lib/services/places";
import {
  authorizeDiscoveryActor,
  authorizeDiscoveryProperty,
  clampDiscoveryRadius,
  collectExcludeProviderPlaceIds,
  mapDiscoveryError,
  requireOperatorMutate,
} from "@/lib/services/places/discovery-guards";
import {
  bulkConfirmPlaces,
  type BulkConfirmResult,
} from "@/lib/services/places/bulk-confirm-places";
import { reverseGeocodeAddressForPin } from "@/lib/services/places/reverse-geocode";
import { rateJsonSchema } from "@/lib/schemas/rate-tier.schema";
import {
  discoverParkingSuggestions,
  PARKING_CATEGORY_KEY,
  type ParkingDiscoveryResult,
  type ParkingSuggestion,
} from "@/lib/services/parking-discovery.service";
import {
  ARRIVAL_MODES,
  type ArrivalMode,
  arrivalModeCategoryKey,
  DEFAULT_DISCOVERY_RADIUS_M,
} from "@/lib/services/arrival-discovery.service";
import {
  AUDIT_ACTIONS,
  formatActor,
  writeAudit,
} from "@/lib/services/audit.service";
import { visibilityLevels } from "@/lib/visibility";
import type { ActionResult } from "@/lib/types/action-result";

/** Merge a `feeType` change into an existing `providerMetadata` JSON value
 * (or synthesize a fresh metadata blob for manual rows that never had one).
 * Keeps the shape compatible with `ProviderMetadataSchema` so a future re-read
 * + parse round-trips cleanly. */
function mergeFeeTypeIntoMetadata(
  existing: unknown,
  feeType: "free" | "paid" | null,
): ProviderMetadata {
  const parsed = ProviderMetadataSchema.safeParse(existing);
  const base: ProviderMetadata = parsed.success
    ? parsed.data
    : {
        nativeCategory: null,
        placeTypes: [],
        confidence: null,
        retrievedAt: new Date().toISOString(),
      };
  return { ...base, feeType };
}

// ── 1) Refresh parking suggestions cache ──
//
// `expensive` bucket per actor (10/60s) layered on top of a per-property
// limiter (30/60s, sliding window). The cascade catches both single-actor
// flooding and coordinated bursts targeting the same property.
//
// Re-runs discovery + persists the result on `Property.parkingSuggestionsCacheJson`
// so the cockpit serves cached suggestions on first paint without a client
// round-trip. The on-demand path; first-paint hydration lives in `page.tsx`.

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

export async function refreshParkingSuggestionsAction(
  propertyId: string,
  language: "es" | "en" = "es",
  radiusMeters: number = DEFAULT_DISCOVERY_RADIUS_M,
): Promise<ActionResult<ParkingSearchResult>> {
  if (!propertyId) return { success: false, error: "Falta propertyId" };
  const clampedRadius = clampDiscoveryRadius(radiusMeters);

  const auth = await authorizeDiscoveryActor();
  if (!auth.ok) return { success: false, error: auth.error };
  const { operator } = auth;

  // Property + already-confirmed pin list are independent reads — fire in
  // parallel. The rate-limit hit lands after validation so a non-existent
  // property doesn't burn the property-scoped bucket.
  const [property, existing] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId, workspaceId: operator.workspaceId },
      select: { latitude: true, longitude: true },
    }),
    prisma.localPlace.findMany({
      where: {
        propertyId,
        property: { workspaceId: operator.workspaceId },
        categoryKey: PARKING_CATEGORY_KEY,
        providerPlaceId: { not: null },
      },
      select: { providerPlaceId: true },
    }),
  ]);
  if (!property) return { success: false, error: "Propiedad no encontrada" };
  if (property.latitude === null || property.longitude === null) {
    return { success: false, error: "La propiedad no tiene coordenadas" };
  }

  const propGate = authorizeDiscoveryProperty(`parking:${propertyId}`);
  if (!propGate.ok) return { success: false, error: propGate.error };

  try {
    const result = await discoverParkingSuggestions({
      anchor: { latitude: property.latitude, longitude: property.longitude },
      language,
      excludeProviderPlaceIds: collectExcludeProviderPlaceIds(existing),
      radiusMeters: clampedRadius,
    });
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        parkingSuggestionsCacheJson: result.suggestions as unknown as Prisma.InputJsonValue,
        parkingSuggestionsCachedAt: new Date(),
      },
    });
    revalidatePath(`/properties/${propertyId}/access`);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: mapDiscoveryError(err, "[parking-refresh]", { propertyId }),
    };
  }
}

// ── 1.b) Reverse-geocode at a coordinate ──
//
// Used by the cockpit's click-to-place draft pin flow to autofill name +
// address whenever the operator drops (or moves) a draft pin on the map.
// Returns `match: null` on no POI near the click. `expensive` bucket per
// actor; no per-property limiter — clicks on the map are bounded by the
// UI debounce, not by burst risk. The mode parameter selects the provider's
// category preference (parking glyph vs the matching transit category) so
// the same coord can yield a different best match depending on which tab
// is armed.

export interface ReverseGeocodeForPinResult {
  /** `null` when the provider returned zero features near the coordinate. */
  match: {
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
  } | null;
}

const reverseGeocodePinSchema = z
  .object({
    propertyId: z.string().min(1),
    mode: z.enum([...ARRIVAL_MODES, "parking"]),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    language: z.enum(["es", "en"]).optional(),
  })
  .strict();

export type ReverseGeocodeForPinInput = z.infer<typeof reverseGeocodePinSchema>;

export async function reverseGeocodeForPinAction(
  input: ReverseGeocodeForPinInput,
): Promise<ActionResult<ReverseGeocodeForPinResult>> {
  const parsed = reverseGeocodePinSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const auth = await authorizeDiscoveryActor();
  if (!auth.ok) return { success: false, error: auth.error };
  const { operator } = auth;

  const property = await prisma.property.findUnique({
    where: { id: parsed.data.propertyId, workspaceId: operator.workspaceId },
    select: { id: true },
  });
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  const provider = resolveLocalPoiProvider();
  if (typeof provider.reverse !== "function") {
    return { success: true, data: { match: null } };
  }

  const preferCategoryKey =
    parsed.data.mode === "parking"
      ? PARKING_CATEGORY_KEY
      : arrivalModeCategoryKey(parsed.data.mode as ArrivalMode);

  try {
    const hit = await provider.reverse({
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      language: parsed.data.language ?? "es",
      preferCategoryKey,
      signal: AbortSignal.timeout(2000),
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
        },
      },
    };
  } catch (err) {
    if (err instanceof PoiProviderConfigError) {
      return { success: false, error: "Proveedor de mapas no configurado" };
    }
    if (err instanceof PoiProviderUnavailableError) {
      console.error(
        `[pin-reverse] propertyId=${parsed.data.propertyId} mode=${parsed.data.mode} provider unavailable:`,
        err.message,
      );
      return { success: false, error: "Proveedor de mapas no disponible" };
    }
    const name = (err as { name?: string }).name;
    if (name === "AbortError" || name === "TimeoutError") {
      return { success: true, data: { match: null } };
    }
    console.error(
      `[pin-reverse] propertyId=${parsed.data.propertyId} mode=${parsed.data.mode} error:`,
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
    /** Operator-chosen fee classification at confirm time. Optional — `null`
     * persists "unclassified" and the operator can set it later via
     * `updateParkingPlaceAction`. Merged into `providerMetadata.feeType`. */
    feeType: z.enum(["free", "paid"]).nullable().optional(),
    providerMetadata: ProviderMetadataSchema,
  })
  .strict();

export type ConfirmParkingInput = z.infer<typeof confirmParkingSchema>;

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

export type ConfirmParkingBulkResult = BulkConfirmResult;

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

  // Delegates the operator/property scaffolding, parallel creates, P2002
  // dedupe and per-row writeAudit emission to `bulkConfirmPlaces`. The
  // parking-specific bits are the constant categoryKey + the optional
  // `feeType` merge into providerMetadata; everything else is shared with
  // `confirmArrivalOptionsBulkAction`.
  return bulkConfirmPlaces({
    items: parsed.data.items,
    categoryKeyOf: () => PARKING_CATEGORY_KEY,
    transformMetadata: (item) =>
      item.feeType !== undefined
        ? mergeFeeTypeIntoMetadata(item.providerMetadata, item.feeType)
        : item.providerMetadata,
    auditSource: "provider-suggestion-bulk",
  });
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

  const auth = await requireOperatorMutate();
  if (!auth.ok) return { success: false, error: auth.error };
  const { operator } = auth;

  // Property lookup and reverse-geocode are independent — fire them in
  // parallel. The reverse-geocode runs unconditionally; the result is only
  // used when the caller didn't supply an address. The race is benign: even
  // if `property` is null we still pay the provider RTT, but the action
  // returns immediately and abandons the result. Caller-supplied address
  // wins (e.g. when a future form prompts the operator); otherwise we ask
  // the provider so manual pins parity-match suggestion-confirm rows.
  const [property, fallbackAddress] = await Promise.all([
    prisma.property.findUnique({
      where: { id: parsed.data.propertyId, workspaceId: operator.workspaceId },
      select: { id: true, latitude: true, longitude: true },
    }),
    parsed.data.address === undefined || parsed.data.address === null
      ? reverseGeocodeAddressForPin({
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          preferCategoryKey: PARKING_CATEGORY_KEY,
        })
      : Promise.resolve(null),
  ]);
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  // Leave the JSON column empty when feeType is unspecified — absence of
  // metadata is the canonical "not classified" signal.
  const providerMetadata =
    parsed.data.feeType === "free" || parsed.data.feeType === "paid"
      ? mergeFeeTypeIntoMetadata(null, parsed.data.feeType)
      : null;

  const distanceMeters =
    property.latitude !== null && property.longitude !== null
      ? haversineMeters(
          { latitude: property.latitude, longitude: property.longitude },
          { latitude: parsed.data.latitude, longitude: parsed.data.longitude },
        )
      : null;

  const resolvedAddress = parsed.data.address ?? fallbackAddress;

  const created = await prisma.localPlace.create({
    data: {
      propertyId: parsed.data.propertyId,
      categoryKey: PARKING_CATEGORY_KEY,
      name: parsed.data.name,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      address: resolvedAddress,
      shortNote: parsed.data.shortNote ?? null,
      distanceMeters,
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

  revalidatePath(`/properties/${parsed.data.propertyId}/access`);
  return { success: true, data: { id: created.id } };
}

// ── 4) Update an existing parking pin ──
//
// Editable surface: name, shortNote, visibility, feeType, and coordinates
// (relocate). When coords are provided, we re-geocode internally to refresh
// the address and recompute distance from the property anchor — the operator
// never types coords by hand, they come from a map click. Provider/website
// stay immutable; re-confirming a provider suggestion is the path for those.

// Operator-edited tariff for paid parking. Multi-tier: real parkings layer
// pricing (e.g. €2/min but €18/día cap with discount), so the shape is an
// array of {amount, currency, per, note} entries. Pass `null` to clear
// (e.g. when toggling a row back to `free`). Empty array = no tiers yet.

const updateParkingSchema = z
  .object({
    placeId: z.string().min(1),
    // Empty string is allowed — the editor renders the row's italic "Añadir
    // nombre" placeholder when the stored name is blank, so blanking a name
    // is a legitimate user intent (e.g. clear an old label before renaming).
    name: z.string().optional(),
    shortNote: z.string().nullable().optional(),
    visibility: z.enum(visibilityLevels).optional(),
    feeType: z.enum(["free", "paid"]).nullable().optional(),
    // Recommended flag is single-select within the feeType bucket (free|paid).
    // Toggling true clears `isRecommended` from siblings that share the same
    // effective feeType — matches the UX agreed in 16E.6 (Coche tab groups
    // parking_free + parking_paid; recommended marker is meaningful per bucket).
    isRecommended: z.boolean().optional(),
    rateJson: rateJsonSchema.nullable().optional(),
    latitude: z.number().gte(-90).lte(90).optional(),
    longitude: z.number().gte(-180).lte(180).optional(),
  })
  .strict()
  .refine(
    (v) =>
      (v.latitude === undefined) === (v.longitude === undefined),
    { message: "latitude y longitude deben enviarse juntos" },
  );

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

  const auth = await requireOperatorMutate();
  if (!auth.ok) return { success: false, error: auth.error };
  const { operator } = auth;

  // Relocate path needs a fresh reverse-geocode — fire it in parallel with the
  // place lookup. Both reads are independent (the geocoder uses only the new
  // coords). Saves one provider RTT on the relocate hot-path.
  const isRelocating =
    parsed.data.latitude !== undefined && parsed.data.longitude !== undefined;
  const [place, relocateAddress] = await Promise.all([
    prisma.localPlace.findFirst({
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
        property: { select: { latitude: true, longitude: true } },
      },
    }),
    isRelocating
      ? reverseGeocodeAddressForPin({
          latitude: parsed.data.latitude!,
          longitude: parsed.data.longitude!,
          preferCategoryKey: PARKING_CATEGORY_KEY,
        })
      : Promise.resolve(null),
  ]);
  if (!place) return { success: false, error: "Pin no encontrado" };

  const data: {
    name?: string;
    shortNote?: string | null;
    visibility?: (typeof visibilityLevels)[number];
    providerMetadata?: ReturnType<typeof mergeFeeTypeIntoMetadata>;
    isRecommended?: boolean;
    rateJson?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    latitude?: number;
    longitude?: number;
    address?: string | null;
    distanceMeters?: number | null;
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
  if (parsed.data.isRecommended !== undefined) {
    data.isRecommended = parsed.data.isRecommended;
  }
  if (parsed.data.rateJson !== undefined) {
    data.rateJson =
      parsed.data.rateJson === null
        ? Prisma.JsonNull
        : (parsed.data.rateJson as Prisma.InputJsonValue);
  }

  // Relocate: re-geocode the new coords for a fresh address and recompute
  // distance from the property anchor. The address is best-effort — null if
  // the provider returns nothing rather than carry stale data from the
  // previous location.
  if (parsed.data.latitude !== undefined && parsed.data.longitude !== undefined) {
    data.latitude = parsed.data.latitude;
    data.longitude = parsed.data.longitude;
    data.distanceMeters =
      place.property.latitude !== null && place.property.longitude !== null
        ? haversineMeters(
            {
              latitude: place.property.latitude,
              longitude: place.property.longitude,
            },
            {
              latitude: parsed.data.latitude,
              longitude: parsed.data.longitude,
            },
          )
        : null;
    data.address = relocateAddress;
  }

  if (Object.keys(data).length === 0) return { success: true };

  // Single-select recommended within (property, feeType bucket): clear siblings
  // that share the same effective feeType, then promote this row. Wrapped in a
  // transaction so a crash between the two writes can't leave the bucket with
  // zero (or two) recommended rows. Free/paid are independent buckets — one
  // recommended free + one recommended paid can coexist. Rows with no feeType
  // classification do not participate in the sweep.
  const effectiveFeeType: "free" | "paid" | null =
    data.isRecommended === true
      ? parsed.data.feeType !== undefined
        ? parsed.data.feeType
        : (ProviderMetadataSchema.safeParse(place.providerMetadata).data
            ?.feeType ?? null)
      : null;

  if (data.isRecommended === true && effectiveFeeType !== null) {
    await prisma.$transaction([
      prisma.localPlace.updateMany({
        where: {
          propertyId: place.propertyId,
          categoryKey: PARKING_CATEGORY_KEY,
          id: { not: place.id },
          isRecommended: true,
          providerMetadata: { path: ["feeType"], equals: effectiveFeeType },
        },
        data: { isRecommended: false },
      }),
      prisma.localPlace.update({
        where: { id: place.id },
        data,
      }),
    ]);
  } else {
    await prisma.localPlace.update({
      where: { id: place.id },
      data,
    });
  }

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
      ...(parsed.data.isRecommended !== undefined
        ? { isRecommended: parsed.data.isRecommended }
        : {}),
      ...(parsed.data.rateJson !== undefined ? { rateJson: parsed.data.rateJson } : {}),
      ...(parsed.data.latitude !== undefined
        ? {
            latitude: parsed.data.latitude,
            longitude: parsed.data.longitude,
            distanceMeters: data.distanceMeters ?? null,
            address: data.address ?? null,
          }
        : {}),
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

  const auth = await requireOperatorMutate();
  if (!auth.ok) return { success: false, error: auth.error };
  const { operator } = auth;

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

