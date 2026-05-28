"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ProviderMetadataSchema,
  haversineMeters,
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
import { applyOperatorRateLimit } from "@/lib/services/operator-rate-limit";
import { rateJsonSchema } from "@/lib/schemas/rate-tier.schema";
import {
  ARRIVAL_MODES,
  DEFAULT_DISCOVERY_RADIUS_M,
  type ArrivalMode,
  arrivalModeCategoryKey,
  discoverArrivalSuggestions,
  type ArrivalDiscoveryResult,
  type ArrivalSuggestion,
} from "@/lib/services/arrival-discovery.service";
import {
  AUDIT_ACTIONS,
  formatActor,
  writeAudit,
} from "@/lib/services/audit.service";
import type { ActionResult } from "@/lib/types/action-result";

const arrivalModeSchema = z.enum(ARRIVAL_MODES);

/** Set of categoryKeys derived from `ARRIVAL_MODES` — bound to the enum so
 * adding a new mode propagates here automatically, instead of relying on a
 * fragile `startsWith("lp.arrival_")` prefix that assumes the naming
 * convention will never change. */
const ARRIVAL_CATEGORY_KEYS = ARRIVAL_MODES.map(arrivalModeCategoryKey);

// Aliased so action signatures don't carry inline `{ id: string }` literals
// that confuse the audit-coverage walker.
export interface ArrivalOptionCreated {
  id: string;
}

export interface ArrivalSearchResult {
  suggestions: ArrivalSuggestion[];
  warningKey: ArrivalDiscoveryResult["warningKey"];
  totalBeforeCap: number;
}

// ── 1) Discover suggestions for a mode ──
//
// `expensive` per-actor bucket + per-property limiter mirroring parking.
// Results are cached per-mode on `Property.arrivalSuggestionsCacheJson` so the
// "Sugeridos" column hydrates on first paint of subsequent visits. The cache
// is invalidated (NULLed) by `saveProperty` whenever coords could have shifted
// — the operator refreshes per mode via the icon-only button on the cockpit.

export async function discoverArrivalSuggestionsAction(
  propertyId: string,
  mode: ArrivalMode,
  language: "es" | "en" = "es",
  radiusMeters: number = DEFAULT_DISCOVERY_RADIUS_M,
): Promise<ActionResult<ArrivalSearchResult>> {
  if (!propertyId) return { success: false, error: "Falta propertyId" };
  const parsedMode = arrivalModeSchema.safeParse(mode);
  if (!parsedMode.success) return { success: false, error: "Modo desconocido" };
  const clampedRadius = clampDiscoveryRadius(radiusMeters);

  const auth = await authorizeDiscoveryActor();
  if (!auth.ok) return { success: false, error: auth.error };
  const { operator } = auth;

  // Property + already-confirmed pin list are independent reads — fire in
  // parallel. categoryKey is derived from the input mode (no DB dependency).
  // Rate-limit hit lands after validation so an unknown property doesn't burn
  // the bucket. We no longer read arrivalSuggestionsCacheJson here: the cache
  // merge runs server-side via JSONB `||` (read-modify-write in JS would let
  // concurrent refreshes of different modes clobber each other's payload).
  const categoryKey = arrivalModeCategoryKey(parsedMode.data);
  const [property, existing] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId, workspaceId: operator.workspaceId },
      select: { latitude: true, longitude: true },
    }),
    prisma.localPlace.findMany({
      where: {
        propertyId,
        property: { workspaceId: operator.workspaceId },
        categoryKey,
        providerPlaceId: { not: null },
      },
      select: { providerPlaceId: true },
    }),
  ]);
  if (!property) return { success: false, error: "Propiedad no encontrada" };
  if (property.latitude === null || property.longitude === null) {
    return { success: false, error: "La propiedad no tiene coordenadas" };
  }

  const propGate = authorizeDiscoveryProperty(
    `arrival:${propertyId}:${parsedMode.data}`,
  );
  if (!propGate.ok) return { success: false, error: propGate.error };

  try {
    const result = await discoverArrivalSuggestions({
      mode: parsedMode.data,
      anchor: { latitude: property.latitude, longitude: property.longitude },
      language,
      excludeProviderPlaceIds: collectExcludeProviderPlaceIds(existing),
      radiusMeters: clampedRadius,
    });
    // Fire-and-forget atomic cache merge — the render path doesn't block on
    // persistence. JSONB `||` operator merges keys at the SQL layer so
    // concurrent refreshes of different modes can never clobber each other:
    // each UPDATE only touches its own key. Workspace scope on the WHERE
    // clause keeps the write tamper-resistant (same as setArrivalModeEnabled).
    const delta = JSON.stringify({ [parsedMode.data]: result.suggestions });
    void prisma
      .$executeRaw`
        UPDATE "properties"
        SET "arrival_suggestions_cache_json" =
          COALESCE("arrival_suggestions_cache_json", '{}'::jsonb) || ${delta}::jsonb
        WHERE id = ${propertyId}
          AND workspace_id = ${operator.workspaceId}
      `.catch((err) => {
        console.error(
          `[arrival-discovery] cache write failed for ${propertyId} mode=${parsedMode.data}:`,
          err,
        );
      });
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: mapDiscoveryError(err, "[arrival-discovery]", {
        propertyId,
        mode: parsedMode.data,
      }),
    };
  }
}

// ── 2) Bulk-confirm provider suggestions for a mode ──

const confirmItemSchema = z
  .object({
    propertyId: z.string().min(1),
    mode: arrivalModeSchema,
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

const confirmArrivalBulkSchema = z
  .object({
    items: z.array(confirmItemSchema).min(1).max(20),
  })
  .strict();

export type ConfirmArrivalBulkInput = z.infer<typeof confirmArrivalBulkSchema>;

export type ConfirmArrivalBulkResult = BulkConfirmResult;

export async function confirmArrivalOptionsBulkAction(
  input: ConfirmArrivalBulkInput,
): Promise<ActionResult<ConfirmArrivalBulkResult>> {
  const parsed = confirmArrivalBulkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Delegates the operator/property scaffolding, parallel creates, P2002
  // dedupe and per-row writeAudit emission to `bulkConfirmPlaces`. The
  // arrival-specific bit is deriving `categoryKey` per-item from `mode`;
  // providerMetadata passes through unchanged. Mirrors
  // `confirmParkingPlacesBulkAction`.
  return bulkConfirmPlaces({
    items: parsed.data.items,
    categoryKeyOf: (item) => arrivalModeCategoryKey(item.mode),
    auditSource: "arrival-suggestion-bulk",
  });
}

// ── 3) Add manual arrival pin ──

const manualArrivalSchema = z
  .object({
    propertyId: z.string().min(1),
    mode: arrivalModeSchema,
    name: z.string().min(1, "El nombre es obligatorio"),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    address: z.string().nullable().optional(),
    shortNote: z.string().nullable().optional(),
  })
  .strict();

export type ManualArrivalInput = z.infer<typeof manualArrivalSchema>;

export async function addManualArrivalOptionAction(
  input: ManualArrivalInput,
): Promise<ActionResult<ArrivalOptionCreated>> {
  const parsed = manualArrivalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const auth = await requireOperatorMutate();
  if (!auth.ok) return { success: false, error: auth.error };
  const { operator } = auth;

  // Ownership first — never fire a provider RTT for a workspace the caller
  // doesn't own. Caller-supplied address wins; otherwise we ask the provider
  // (gated by `expensive` bucket) for a display-only address — bare reverse,
  // no `preferCategoryKey` (the strict category contract would always return
  // null since MapTiler classifies transit under `lp.transport`, not under
  // our synthetic `lp.arrival_*` namespace; see comment on the reverse call
  // below for the full reasoning).
  const categoryKey = arrivalModeCategoryKey(parsed.data.mode);
  const property = await prisma.property.findUnique({
    where: { id: parsed.data.propertyId, workspaceId: operator.workspaceId },
    select: { id: true, latitude: true, longitude: true },
  });
  if (!property) return { success: false, error: "Propiedad no encontrada" };

  // Reverse-geocode is best-effort: only call when the caller didn't supply
  // an address, and gate the external call with the `expensive` bucket so a
  // burst of manual pins can't drain the MapTiler quota. Limiter-denied =
  // skip the geocode (the mutation still proceeds with a null address).
  //
  // Bare reverse (no `preferCategoryKey`) — the synthetic `lp.arrival_*`
  // namespace is internal-only; MapTiler classifies every transit POI under
  // the generic `lp.transport` bucket, so the strict category contract would
  // always return null here. The operator already declared the mode by
  // choosing the active tab; the geocoded address is for display only, not
  // for category validation.
  const needsFallbackAddress =
    parsed.data.address === undefined || parsed.data.address === null;
  let fallbackAddress: string | null = null;
  if (needsFallbackAddress) {
    const gate = applyOperatorRateLimit({
      userId: operator.userId,
      bucket: "expensive",
    });
    if (gate.ok) {
      fallbackAddress = await reverseGeocodeAddressForPin({
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      });
    }
  }

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
      categoryKey,
      name: parsed.data.name,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      address: resolvedAddress,
      shortNote: parsed.data.shortNote ?? null,
      distanceMeters,
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
      categoryKey,
      name: parsed.data.name,
      visibility: "guest",
      source: "manual",
    },
  });

  revalidatePath(`/properties/${parsed.data.propertyId}/access`);
  return { success: true, data: { id: created.id } };
}

// ── 4) Update an arrival option ──
//
// Editable: name, shortNote (per-option arrival note edited from sec 3),
// isRecommended (mode-scoped flag), latitude/longitude (relocate from the
// unified map). When toggling isRecommended=true we implicitly clear it from
// any sibling in the same (property, mode) so the "recommended" set is
// single-select per mode — matches the UX agreed in 16E.6: the marker is
// meaningful only as a single highlighted option. On relocate we re-geocode
// the new coordinate to refresh the address and recompute distance from the
// property anchor, mirroring updateParkingPlaceAction.

const updateArrivalSchema = z
  .object({
    placeId: z.string().min(1),
    name: z.string().optional(),
    shortNote: z.string().nullable().optional(),
    isRecommended: z.boolean().optional(),
    // `isVisibleToGuest: false` flips `LocalPlace.visibility` to `internal`
    // (operator keeps the row but the guest guide hides it). `true` flips
    // back to `guest`. Sensitive/AI levels are out of scope for arrival pins.
    isVisibleToGuest: z.boolean().optional(),
    latitude: z.number().gte(-90).lte(90).optional(),
    longitude: z.number().gte(-180).lte(180).optional(),
  })
  .strict()
  .refine(
    (v) => (v.latitude === undefined) === (v.longitude === undefined),
    { message: "latitude y longitude deben enviarse juntos" },
  );

export type UpdateArrivalInput = z.infer<typeof updateArrivalSchema>;

export async function updateArrivalOptionAction(
  input: UpdateArrivalInput,
): Promise<ActionResult> {
  const parsed = updateArrivalSchema.safeParse(input);
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
      categoryKey: { in: ARRIVAL_CATEGORY_KEYS },
      property: { workspaceId: operator.workspaceId },
    },
    select: {
      id: true,
      propertyId: true,
      categoryKey: true,
      property: { select: { latitude: true, longitude: true } },
    },
  });
  if (!place) return { success: false, error: "Opción no encontrada" };

  const data: {
    name?: string;
    shortNote?: string | null;
    isRecommended?: boolean;
    visibility?: "guest" | "internal";
    latitude?: number;
    longitude?: number;
    address?: string | null;
    distanceMeters?: number | null;
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.shortNote !== undefined) data.shortNote = parsed.data.shortNote;
  if (parsed.data.isRecommended !== undefined) {
    data.isRecommended = parsed.data.isRecommended;
  }
  if (parsed.data.isVisibleToGuest !== undefined) {
    data.visibility = parsed.data.isVisibleToGuest ? "guest" : "internal";
  }

  // Relocate: re-geocode the new coords and recompute distance. Address is
  // best-effort — null if the provider returns nothing or the `expensive`
  // bucket is exhausted, rather than carry stale data from the previous
  // location. Bare reverse (no `preferCategoryKey`) — see the create action
  // for the rationale: the synthetic `lp.arrival_*` namespace never matches
  // MapTiler's `lp.transport` classification, and the operator-declared
  // mode is already the source of truth.
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
    const gate = applyOperatorRateLimit({
      userId: operator.userId,
      bucket: "expensive",
    });
    data.address = gate.ok
      ? await reverseGeocodeAddressForPin({
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
        })
      : null;
  }

  if (Object.keys(data).length === 0) return { success: true };

  // Single-select recommended within (property, mode): clear siblings first,
  // then promote this row. Wrapped in a transaction so a crash between the
  // two writes can't leave the bucket with zero (or two) recommended rows.
  if (data.isRecommended === true) {
    await prisma.$transaction([
      prisma.localPlace.updateMany({
        where: {
          propertyId: place.propertyId,
          categoryKey: place.categoryKey,
          id: { not: place.id },
          isRecommended: true,
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
      ...(parsed.data.isRecommended !== undefined
        ? { isRecommended: parsed.data.isRecommended }
        : {}),
      ...(parsed.data.isVisibleToGuest !== undefined
        ? {
            visibility: parsed.data.isVisibleToGuest ? "guest" : "internal",
          }
        : {}),
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

// ── 5) Delete an arrival option (idempotent) ──

const deleteArrivalSchema = z
  .object({
    placeId: z.string().min(1),
  })
  .strict();

export type DeleteArrivalInput = z.infer<typeof deleteArrivalSchema>;

export async function deleteArrivalOptionAction(
  input: DeleteArrivalInput,
): Promise<ActionResult> {
  const parsed = deleteArrivalSchema.safeParse(input);
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
      categoryKey: { in: ARRIVAL_CATEGORY_KEYS },
      property: { workspaceId: operator.workspaceId },
    },
    select: { id: true, propertyId: true, name: true, categoryKey: true },
  });
  if (!place) return { success: true };

  await prisma.localPlace.delete({ where: { id: place.id } });

  await writeAudit({
    propertyId: place.propertyId,
    actor: formatActor({ type: "user", userId: operator.userId }),
    entityType: "LocalPlace",
    entityId: place.id,
    action: AUDIT_ACTIONS.delete,
    diff: { name: place.name, categoryKey: place.categoryKey },
  });

  revalidatePath(`/properties/${place.propertyId}/access`);
  return { success: true };
}

// ── 6) Toggle a mode on/off ──
//
// Writes the per-mode boolean into `Property.arrivalModesEnabledJson`. Stored
// as a partial record — absent keys fall back to the cockpit's defaults
// (parking follows hasParking; transit modes default false). Audit emitted on
// Property entity so the change shows up in the standard activity feed.

const arrivalModeEnabledSchema = z
  .object({
    propertyId: z.string().min(1),
    mode: z.enum([...ARRIVAL_MODES, "parking"]),
    enabled: z.boolean(),
  })
  .strict();

export type ArrivalModeEnabledInput = z.infer<typeof arrivalModeEnabledSchema>;

export async function setArrivalModeEnabledAction(
  input: ArrivalModeEnabledInput,
): Promise<ActionResult> {
  const parsed = arrivalModeEnabledSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const auth = await requireOperatorMutate();
  if (!auth.ok) return { success: false, error: auth.error };
  const { operator } = auth;

  // Atomic JSONB merge — one round-trip, no read-modify-write window. A
  // concurrent toggle on a different mode merges cleanly because Postgres
  // `||` is applied per-key in a single statement. Ownership is enforced
  // by the `workspace_id` predicate, so we lose nothing by skipping the
  // SELECT. `rows === 0` covers both "no such property" and "wrong
  // workspace" without distinguishing them — leaks no existence signal.
  const delta = JSON.stringify({ [parsed.data.mode]: parsed.data.enabled });
  const rows = await prisma.$executeRaw`
    UPDATE "properties"
    SET "arrival_modes_enabled_json" =
      COALESCE("arrival_modes_enabled_json", '{}'::jsonb) || ${delta}::jsonb
    WHERE id = ${parsed.data.propertyId}
      AND workspace_id = ${operator.workspaceId}
  `;
  if (rows === 0) return { success: false, error: "Propiedad no encontrada" };

  await writeAudit({
    propertyId: parsed.data.propertyId,
    actor: formatActor({ type: "user", userId: operator.userId }),
    entityType: "Property",
    entityId: parsed.data.propertyId,
    action: AUDIT_ACTIONS.update,
    diff: {
      arrivalMode: parsed.data.mode,
      enabled: parsed.data.enabled,
    },
  });

  revalidatePath(`/properties/${parsed.data.propertyId}/access`);
  return { success: true };
}

// ── 7) Set per-option rate (paid parking only) ──
//
// Tariff editor lives in sec 3 alongside the parking option list. Writes to
// LocalPlace.rateJson; null clears the tariff. Validates shape but does not
// enforce categoryKey === parking — operators may eventually attach rates to
// other paid arrival options (toll passes, paid ferries) and we want the
// column to support that without a second migration.

const setArrivalRateSchema = z
  .object({
    placeId: z.string().min(1),
    rate: rateJsonSchema.nullable(),
  })
  .strict();

export type SetArrivalRateInput = z.infer<typeof setArrivalRateSchema>;

export async function setArrivalOptionRateAction(
  input: SetArrivalRateInput,
): Promise<ActionResult> {
  const parsed = setArrivalRateSchema.safeParse(input);
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
      property: { workspaceId: operator.workspaceId },
    },
    select: { id: true, propertyId: true },
  });
  if (!place) return { success: false, error: "Opción no encontrada" };

  await prisma.localPlace.update({
    where: { id: place.id },
    data: {
      rateJson:
        parsed.data.rate === null
          ? Prisma.JsonNull
          : (parsed.data.rate as unknown as Prisma.InputJsonValue),
    },
  });

  await writeAudit({
    propertyId: place.propertyId,
    actor: formatActor({ type: "user", userId: operator.userId }),
    entityType: "LocalPlace",
    entityId: place.id,
    action: AUDIT_ACTIONS.update,
    diff: { rate: parsed.data.rate },
  });

  revalidatePath(`/properties/${place.propertyId}/access`);
  return { success: true };
}
