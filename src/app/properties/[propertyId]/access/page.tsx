import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getDownloadUrl } from "@/lib/services/media-storage.service";
import {
  ACCESS_COCKPIT_IDS,
  ACCESS_USAGE_KEYS,
  type AccessCockpitId,
} from "@/lib/icons/access-icons";
import {
  accessibilityFeatures,
  accessMethods,
  buildingAccessMethods,
  parkingOptions,
} from "@/lib/taxonomy-loader";
import { findItem } from "@/lib/taxonomies/_helpers";
import type { ItemTaxonomyFile } from "@/lib/types/taxonomy";
import {
  PARKING_CATEGORY_KEY,
  type ParkingSuggestion,
} from "@/lib/services/parking-discovery.service";
import {
  ARRIVAL_MODES,
  type ArrivalMode,
  type ArrivalSuggestion,
} from "@/lib/services/arrival-discovery.service";
import {
  parseModesMap,
  readArrivalCache,
} from "@/lib/services/arrival-cache";
import { NO_ACCESSIBILITY_ID } from "@/lib/services/access-tri-state";
import { AccessForm, type ParkingPlace } from "./access-form";
import {
  RATE_TIER_PERS,
  type RateTier,
  type RateTierPer,
} from "./_components/arrival-steps-helpers";
import { LIVE_MAP_USAGE_KEY } from "./_components/subsystem-card.types";
import type {
  SubsystemSlide,
  SubsystemSlides,
} from "./_components/subsystem-card.types";
import type { ArrivalOption } from "./_components/arrival-modes-editor";

interface Props {
  params: Promise<{ propertyId: string }>;
}

const SUBSYSTEM_TAXONOMY: Record<AccessCockpitId, ItemTaxonomyFile> = {
  building: buildingAccessMethods,
  unit: accessMethods,
  parking: parkingOptions,
  accessibility: accessibilityFeatures,
};

// Maps trail other media so the carousel cover stays visual when photos/videos
// exist. `live-map` is synthesized after this sort runs (appended last) and
// the entry exists only to satisfy `Record<SubsystemSlide["kind"], number>`.
const KIND_ORDER: Record<SubsystemSlide["kind"], number> = {
  image: 0,
  video: 1,
  map: 2,
  "live-map": 3,
};

// Defensive parse of the cached suggestions JSON. The shape is owned by the
// discovery service; if a future change drops fields, an old cached row stays
// usable as long as the required keys round-trip. Anything malformed is
// silently dropped — first-paint will retry discovery on the next visit (the
// `parkingSuggestionsCachedAt` flip in the writer means we don't loop here).
function readCachedSuggestions(value: unknown): ParkingSuggestion[] {
  if (!Array.isArray(value)) return [];
  const out: ParkingSuggestion[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (
      typeof e.provider !== "string" ||
      typeof e.providerPlaceId !== "string" ||
      typeof e.name !== "string" ||
      typeof e.latitude !== "number" ||
      typeof e.longitude !== "number" ||
      typeof e.distanceMeters !== "number"
    ) {
      continue;
    }
    out.push(entry as unknown as ParkingSuggestion);
  }
  return out;
}

function parseSubsystem(usageKey: string): AccessCockpitId | null {
  const segs = usageKey.split(".");
  if (segs.length < 2 || segs[0] !== "access") return null;
  const sub = segs[1] as AccessCockpitId;
  return ACCESS_COCKPIT_IDS.includes(sub) ? sub : null;
}

/** Parse one tier object defensively. Returns null on any malformed field. */
function parseRateTier(o: Record<string, unknown>): RateTier | null {
  if (typeof o.amount !== "number" || !Number.isFinite(o.amount) || o.amount < 0) {
    return null;
  }
  if (typeof o.currency !== "string" || o.currency.trim() === "") return null;
  // Legacy single-tier records used `hour|day|month`; the multi-tier shape
  // extended it with `minute` and `week`. Drop anything outside the union.
  if (typeof o.per !== "string" || !RATE_TIER_PERS.has(o.per as RateTierPer)) {
    return null;
  }
  return {
    amount: o.amount,
    currency: o.currency,
    per: o.per as RateTierPer,
    note: typeof o.note === "string" ? o.note : undefined,
  };
}

/** Parse `LocalPlace.rateJson` defensively into the multi-tier array shape.
 * Accepts both the new array shape and the legacy single-object shape
 * (auto-wrapped to a 1-tier array) — backward-compatible read path. */
function parseRateJson(r: unknown): RateTier[] {
  if (!r || typeof r !== "object") return [];
  if (Array.isArray(r)) {
    return r
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .map(parseRateTier)
      .filter((t): t is RateTier => t !== null);
  }
  const single = parseRateTier(r as Record<string, unknown>);
  return single ? [single] : [];
}

function classifyKind(
  usageKey: string,
  mimeType: string,
): SubsystemSlide["kind"] | null {
  if (usageKey.endsWith(".map")) return "map";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

function resolveOverlayTitle(
  usageKey: string,
  subsystem: AccessCockpitId,
): string {
  // access.<sub>                 → "Portada"
  // access.<sub>.<methodId>      → method label (taxonomy lookup)
  // access.<sub>.map             → "Mapa"
  // access.<sub>.<methodId>.map  → "<method> · Mapa"
  const segs = usageKey.split(".");
  const isMap = segs[segs.length - 1] === "map";
  const tail = isMap ? segs.slice(0, -1) : segs;
  // tail = ["access", "<sub>"] | ["access", "<sub>", "<methodId>"]
  if (tail.length === 2) return isMap ? "Mapa" : "Portada";
  if (tail.length >= 3) {
    const methodId = tail.slice(2).join(".");
    const taxonomy = SUBSYSTEM_TAXONOMY[subsystem];
    const label = findItem(taxonomy, methodId)?.label ?? "Detalle";
    return isMap ? `${label} · Mapa` : label;
  }
  return "Portada";
}

export default async function AccessPage({ params }: Props) {
  const { propertyId } = await params;

  const [
    property,
    accessAssignments,
    legacyAccessPhotoCount,
    propertyMediaCount,
    parkingPlaces,
    arrivalOptionRows,
  ] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        publicSlug: true,
        streetAddress: true,
        city: true,
        latitude: true,
        longitude: true,
        checkInStart: true,
        checkInEnd: true,
        checkOutTime: true,
        accessMethodsJson: true,
        primaryAccessMethod: true,
        isAutonomousCheckin: true,
        hasBuildingAccess: true,
        hasAccessibilityConsiderations: true,
        parkingSuggestionsCacheJson: true,
        parkingSuggestionsCachedAt: true,
        arrivalSuggestionsCacheJson: true,
        arrivalModesEnabledJson: true,
      },
    }),
    // Single grouped query — replaces 4 separate `count(...)` calls. Pulls
    // the full slide payload for every subsystem in one round-trip. Worst
    // case ~5 slides × 4 cards = 20 rows; cheap.
    prisma.mediaAssignment.findMany({
      where: {
        entityType: "access_method",
        entityId: propertyId,
        OR: ACCESS_COCKPIT_IDS.flatMap((sub) => {
          const root = ACCESS_USAGE_KEYS[sub];
          return [{ usageKey: root }, { usageKey: { startsWith: `${root}.` } }];
        }),
      },
      select: {
        id: true,
        sortOrder: true,
        createdAt: true,
        usageKey: true,
        mediaAsset: {
          select: {
            id: true,
            mimeType: true,
            storageKey: true,
            blurhash: true,
            caption: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    // Legacy assignments (no `usageKey`) — pre-segmentation, surfaced in
    // the unit panel only as an upgrade hint.
    prisma.mediaAssignment.count({
      where: {
        entityType: "access_method",
        entityId: propertyId,
        usageKey: null,
      },
    }),
    prisma.mediaAssignment.count({
      where: { entityType: "property", entityId: propertyId },
    }),
    // Parking pins: `LocalPlace` rows tagged `lp.parking`, sorted to match the
    // existing local-place repository convention so a future shared loader can
    // drop in without re-sorting.
    prisma.localPlace.findMany({
      where: { propertyId, categoryKey: PARKING_CATEGORY_KEY },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        shortNote: true,
        distanceMeters: true,
        latitude: true,
        longitude: true,
        address: true,
        provider: true,
        providerPlaceId: true,
        providerMetadata: true,
        isRecommended: true,
        rateJson: true,
      },
    }),
    // Arrival options (train/bus/airport/metro) — same `LocalPlace` table reused
    // via the `lp.arrival_<mode>` categoryKey prefix. `rateJson` only populated
    // for paid options (parking + ferries today); `isRecommended` surfaces a
    // star marker in the per-mode list.
    prisma.localPlace.findMany({
      where: {
        propertyId,
        categoryKey: { startsWith: "lp.arrival_" },
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        shortNote: true,
        distanceMeters: true,
        latitude: true,
        longitude: true,
        address: true,
        provider: true,
        providerPlaceId: true,
        providerMetadata: true,
        categoryKey: true,
        isRecommended: true,
        rateJson: true,
      },
    }),
  ]);

  if (!property) redirect("/");

  // ── Group + classify + sign ──
  const groups: Record<AccessCockpitId, typeof accessAssignments> = {
    building: [],
    unit: [],
    parking: [],
    accessibility: [],
  };
  for (const row of accessAssignments) {
    if (!row.usageKey) continue;
    const sub = parseSubsystem(row.usageKey);
    if (sub) groups[sub].push(row);
  }

  const subsystemSlides: SubsystemSlides = {
    building: [],
    unit: [],
    parking: [],
    accessibility: [],
  };

  await Promise.all(
    ACCESS_COCKPIT_IDS.map(async (sub) => {
      const rows = groups[sub];
      // Classify; drop unknown kinds (warn in dev so missing classifiers
      // surface during development).
      const classified = rows
        .map((row) => {
          const usageKey = row.usageKey!;
          const kind = classifyKind(usageKey, row.mediaAsset.mimeType);
          if (!kind) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                `[access] unknown-media-kind usageKey=${usageKey} mime=${row.mediaAsset.mimeType}`,
              );
            }
            return null;
          }
          return { row, usageKey, kind };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      // Order: kind (image → map → video), then preserve DB order
      // (sortOrder asc, createdAt asc — already applied by the query).
      classified.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

      // Sign URLs in parallel. If a sign fails (missing R2 env in dev),
      // drop that slide rather than crashing the page render.
      const signed = await Promise.all(
        classified.map(async ({ row, usageKey, kind }) => {
          let url: string;
          try {
            url = await getDownloadUrl(row.mediaAsset.storageKey);
          } catch (err) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                `[access] sign-failed assignment=${row.id} key=${row.mediaAsset.storageKey}`,
                err,
              );
            }
            return null;
          }
          const slide: SubsystemSlide = {
            id: row.id,
            assetId: row.mediaAsset.id,
            kind,
            url,
            alt: row.mediaAsset.caption ?? "",
            blurhash: row.mediaAsset.blurhash,
            title: resolveOverlayTitle(usageKey, sub),
            usageKey,
          };
          return slide;
        }),
      );

      subsystemSlides[sub] = signed.filter(
        (s): s is SubsystemSlide => s !== null,
      );
    }),
  );

  // Photo counts derived from slides — preserves the existing sub-panel
  // surface that displays counts in expanded view.
  const buildingPhotoCount = subsystemSlides.building.filter(
    (s) => s.kind === "image",
  ).length;
  const unitPhotoCount = subsystemSlides.unit.filter(
    (s) => s.kind === "image",
  ).length;
  const parkingPhotoCount = subsystemSlides.parking.filter(
    (s) => s.kind === "image",
  ).length;
  const accessibilityPhotoCount = subsystemSlides.accessibility.filter(
    (s) => s.kind === "image",
  ).length;

  const accessJson = property.accessMethodsJson as {
    building?: {
      methods: string[];
      customLabel?: string | null;
      customDesc?: string | null;
      primary?: string | null;
    };
    unit?: { methods: string[]; customLabel?: string | null; customDesc?: string | null };
    parking?: {
      types: string[];
      customLabel?: string | null;
      customDesc?: string | null;
      primary?: string | null;
    } | null;
    accessibility?: {
      features: string[];
      customLabel?: string | null;
      customDesc?: string | null;
    } | null;
  } | null;

  const propertyCoords =
    property.latitude !== null && property.longitude !== null
      ? { latitude: property.latitude, longitude: property.longitude }
      : null;

  // Project `LocalPlace` rows to the minimal `ParkingPlace` shape consumed by
  // the access form. `feeType` lives inside `providerMetadata` (Json) to avoid
  // a column migration; defensive parse — only "free"/"paid" survive, anything
  // else collapses to null.
  const parkingPlacesProjected: ParkingPlace[] = parkingPlaces.map((row) => {
    const meta = row.providerMetadata;
    let feeType: "free" | "paid" | null = null;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const v = (meta as { feeType?: unknown }).feeType;
      if (v === "free" || v === "paid") feeType = v;
    }
    return {
      id: row.id,
      name: row.name,
      shortNote: row.shortNote,
      distanceMeters: row.distanceMeters,
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
      provider: row.provider,
      feeType,
      isRecommended: row.isRecommended,
      rateTiers: parseRateJson(row.rateJson),
    };
  });

  // Parking discovery cache: MapTiler is deterministic for a given (anchor,
  // query) snapshot, so the cockpit serves the cached payload on first paint
  // instead of a client-triggered search per visit. Cache lives on
  // `Property.parkingSuggestionsCacheJson` and is invalidated (NULLed) when
  // the property's coords change. On a cold cache the column renders empty and
  // the operator's first refresh click hits `refreshParkingSuggestionsAction`
  // — which carries the `expensive` per-actor + per-property rate limits.
  // Provider calls intentionally never happen in this server render path:
  // a cache-miss does not authorize an unbounded MapTiler hit per page view.
  const confirmedProviderPlaceIds = new Set<string>(
    parkingPlaces
      .map((p) => p.providerPlaceId)
      .filter((id): id is string => id !== null && id !== ""),
  );
  let parkingSuggestions: ParkingSuggestion[] = readCachedSuggestions(
    property.parkingSuggestionsCacheJson,
  );
  // Filter cached suggestions against the current confirmed pin set so a stale
  // cache (operator confirmed a pin since last write) doesn't surface duplicates.
  if (confirmedProviderPlaceIds.size > 0) {
    parkingSuggestions = parkingSuggestions.filter(
      (s) => !confirmedProviderPlaceIds.has(s.providerPlaceId),
    );
  }

  // Inject a synthetic "live-map" slide into the parking carousel whenever
  // the property has coords — even with zero pins, the map shows the property
  // anchor so the operator can start placing pins from the lightbox. Appended
  // last in KIND_ORDER so other media leads when present.
  const livePins = parkingPlacesProjected
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({
      id: p.id,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      label: p.name,
      feeType: p.feeType,
    }));
  if (propertyCoords !== null) {
    const liveMapSlide: SubsystemSlide = {
      id: "parking-live-map",
      assetId: "",
      kind: "live-map",
      url: "",
      alt: "Mapa interactivo de aparcamientos",
      blurhash: null,
      title: "Mapa",
      usageKey: LIVE_MAP_USAGE_KEY,
      livePins,
      liveAnchor: propertyCoords,
    };
    subsystemSlides.parking = [...subsystemSlides.parking, liveMapSlide];
  }

  // ── Arrival options (transit modes) ──
  // Categorize each row by mode derived from `categoryKey` (`lp.arrival_train`
  // → "train"). Rows whose key doesn't match a known mode are dropped — they
  // represent stale data that survived a taxonomy change.
  const arrivalModeFromKey = (key: string): ArrivalMode | null => {
    const match = /^lp\.arrival_(.+)$/.exec(key);
    if (!match) return null;
    const candidate = match[1] as ArrivalMode;
    return (ARRIVAL_MODES as readonly string[]).includes(candidate)
      ? candidate
      : null;
  };

  const arrivalOptions: ArrivalOption[] = arrivalOptionRows
    .map((row): ArrivalOption | null => {
      const mode = arrivalModeFromKey(row.categoryKey);
      if (!mode) return null;
      return {
        id: row.id,
        mode,
        name: row.name,
        shortNote: row.shortNote,
        distanceMeters: row.distanceMeters,
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
        provider: row.provider,
        providerPlaceId: row.providerPlaceId,
        isRecommended: row.isRecommended,
        rateTiers: parseRateJson(row.rateJson),
      };
    })
    .filter((o): o is ArrivalOption => o !== null);

  // Per-mode enable/disable. Absent → defaults: parking follows existing data
  // (auto-enabled when LocalPlace pins exist or parking types selected); all
  // other modes default off until the operator opts in.
  const arrivalModesEnabled = parseModesMap(property.arrivalModesEnabledJson);

  // Arrival suggestions cache — filter against already-confirmed pins so a
  // stale cache (operator confirmed a pin since last refresh) doesn't surface
  // duplicates on first paint, mirroring the parking guard above.
  const arrivalSuggestionsCache: Partial<
    Record<ArrivalMode, ArrivalSuggestion[]>
  > = (() => {
    const cached = readArrivalCache(property.arrivalSuggestionsCacheJson);
    const confirmedByMode = new Map<ArrivalMode, Set<string>>();
    for (const opt of arrivalOptions) {
      if (opt.providerPlaceId === null || opt.providerPlaceId === "") continue;
      const set = confirmedByMode.get(opt.mode) ?? new Set<string>();
      set.add(opt.providerPlaceId);
      confirmedByMode.set(opt.mode, set);
    }
    const out: Partial<Record<ArrivalMode, ArrivalSuggestion[]>> = {};
    for (const [mode, list] of Object.entries(cached) as [
      ArrivalMode,
      ArrivalSuggestion[],
    ][]) {
      const confirmed = confirmedByMode.get(mode);
      const filtered = list.filter(
        (s) =>
          s !== null &&
          typeof s === "object" &&
          typeof s.providerPlaceId === "string" &&
          (!confirmed || !confirmed.has(s.providerPlaceId)),
      );
      if (filtered.length > 0) out[mode] = filtered;
    }
    return out;
  })();

  return (
    <AccessForm
      propertyId={propertyId}
      publicSlug={property.publicSlug}
      streetAddress={property.streetAddress}
      city={property.city}
      propertyMediaCount={propertyMediaCount}
      buildingPhotoCount={buildingPhotoCount}
      unitPhotoCount={unitPhotoCount}
      parkingPhotoCount={parkingPhotoCount}
      accessibilityPhotoCount={accessibilityPhotoCount}
      legacyAccessPhotoCount={legacyAccessPhotoCount}
      subsystemSlides={subsystemSlides}
      parkingPlaces={parkingPlacesProjected}
      parkingSuggestions={parkingSuggestions}
      arrivalOptions={arrivalOptions}
      arrivalModesEnabled={arrivalModesEnabled}
      arrivalSuggestionsCache={arrivalSuggestionsCache}
      propertyCoords={propertyCoords}
      property={{
        checkInStart: property.checkInStart,
        checkInEnd: property.checkInEnd,
        checkOutTime: property.checkOutTime,
        isAutonomousCheckin: property.isAutonomousCheckin,
        hasBuildingAccess: property.hasBuildingAccess,
        buildingAccess: accessJson?.building ?? null,
        unitAccess: accessJson?.unit ?? null,
        primaryUnitMethod: property.primaryAccessMethod,
        parkingTypes: accessJson?.parking?.types ?? [],
        parkingCustomLabel: accessJson?.parking?.customLabel ?? null,
        parkingCustomDesc: accessJson?.parking?.customDesc ?? null,
        parkingPrimary: accessJson?.parking?.primary ?? null,
        // Tri-state hydration: when the operator opted out (false), the JSON
        // payload is null, so we synthesize the `ax.no_accessibility` sentinel
        // here. true + null follow the JSON-or-empty branches naturally.
        accessibilityFeatures:
          property.hasAccessibilityConsiderations === false
            ? [NO_ACCESSIBILITY_ID]
            : (accessJson?.accessibility?.features ?? []),
        accessibilityCustomLabel: accessJson?.accessibility?.customLabel ?? null,
        accessibilityCustomDesc: accessJson?.accessibility?.customDesc ?? null,
      }}
    />
  );
}
