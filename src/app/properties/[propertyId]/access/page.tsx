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
import { AccessForm } from "./access-form";
import type {
  SubsystemSlide,
  SubsystemSlides,
} from "./_components/subsystem-card.types";

interface Props {
  params: Promise<{ propertyId: string }>;
}

const SUBSYSTEM_TAXONOMY: Record<AccessCockpitId, ItemTaxonomyFile> = {
  building: buildingAccessMethods,
  unit: accessMethods,
  parking: parkingOptions,
  accessibility: accessibilityFeatures,
};

// `live-map` is synthesized after this sort runs; the entry exists only to
// satisfy `Record<SubsystemSlide["kind"], number>`.
const KIND_ORDER: Record<SubsystemSlide["kind"], number> = {
  image: 0,
  map: 1,
  video: 2,
  "live-map": 3,
};

const LP_PARKING_CATEGORY = "lp.parking";
const LIVE_MAP_USAGE_KEY = "access.parking.live-map";

function parseSubsystem(usageKey: string): AccessCockpitId | null {
  const segs = usageKey.split(".");
  if (segs.length < 2 || segs[0] !== "access") return null;
  const sub = segs[1] as AccessCockpitId;
  return ACCESS_COCKPIT_IDS.includes(sub) ? sub : null;
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
  // access.<sub>                 → "Principal"
  // access.<sub>.<methodId>      → method label (taxonomy lookup)
  // access.<sub>.map             → "Mapa"
  // access.<sub>.<methodId>.map  → "<method> · Mapa"
  const segs = usageKey.split(".");
  const isMap = segs[segs.length - 1] === "map";
  const tail = isMap ? segs.slice(0, -1) : segs;
  // tail = ["access", "<sub>"] | ["access", "<sub>", "<methodId>"]
  if (tail.length === 2) return isMap ? "Mapa" : "Principal";
  if (tail.length >= 3) {
    const methodId = tail.slice(2).join(".");
    const taxonomy = SUBSYSTEM_TAXONOMY[subsystem];
    const label = findItem(taxonomy, methodId)?.label ?? "Detalle";
    return isMap ? `${label} · Mapa` : label;
  }
  return "Principal";
}

export default async function AccessPage({ params }: Props) {
  const { propertyId } = await params;

  const [
    property,
    accessAssignments,
    legacyAccessPhotoCount,
    propertyMediaCount,
    parkingPlaces,
  ] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        publicSlug: true,
        streetAddress: true,
        latitude: true,
        longitude: true,
        checkInStart: true,
        checkInEnd: true,
        checkOutTime: true,
        accessMethodsJson: true,
        primaryAccessMethod: true,
        isAutonomousCheckin: true,
        hasBuildingAccess: true,
        hasParking: true,
        hasAccessibilityConsiderations: true,
        parkingMapInCover: true,
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
    // Parking pins (16E.6): `LocalPlace` rows tagged `lp.parking` for this
    // property — the cockpit's parking panel renders them as a multi-pin map
    // and editor. Sort matches the existing local-place repository convention
    // so a future shared loader can drop in without re-sorting.
    prisma.localPlace.findMany({
      where: { propertyId, categoryKey: LP_PARKING_CATEGORY },
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
        providerMetadata: true,
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
  // the access form. `feeType` lives inside `providerMetadata` (Json) per the
  // 16E.6 decision to avoid a column migration; defensive parse — `unknown`
  // shape, only "free"/"paid" survive, anything else collapses to null.
  const parkingPlacesProjected: Array<{
    id: string;
    name: string;
    shortNote: string | null;
    distanceMeters: number | null;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    provider: string | null;
    feeType: "free" | "paid" | null;
  }> = parkingPlaces.map((row) => {
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
    };
  });

  // Inject a synthetic "live-map" slide into the parking carousel when the
  // operator has flipped the cover toggle on AND the data exists to render it
  // (≥1 confirmed pin with coords + property anchor). The slide leads the
  // parking carousel so it surfaces as the cover when the card collapses.
  const livePins = parkingPlacesProjected
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({
      id: p.id,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      label: p.name,
      feeType: p.feeType,
    }));
  if (
    property.parkingMapInCover &&
    livePins.length > 0 &&
    propertyCoords !== null
  ) {
    const liveMapSlide: SubsystemSlide = {
      id: "parking-live-map",
      kind: "live-map",
      url: "",
      alt: "Mapa interactivo de aparcamientos",
      blurhash: null,
      title: "Mapa",
      usageKey: LIVE_MAP_USAGE_KEY,
      livePins,
      liveAnchor: propertyCoords,
    };
    subsystemSlides.parking = [liveMapSlide, ...subsystemSlides.parking];
  }

  return (
    <AccessForm
      propertyId={propertyId}
      publicSlug={property.publicSlug}
      streetAddress={property.streetAddress}
      propertyMediaCount={propertyMediaCount}
      buildingPhotoCount={buildingPhotoCount}
      unitPhotoCount={unitPhotoCount}
      parkingPhotoCount={parkingPhotoCount}
      accessibilityPhotoCount={accessibilityPhotoCount}
      legacyAccessPhotoCount={legacyAccessPhotoCount}
      subsystemSlides={subsystemSlides}
      parkingPlaces={parkingPlacesProjected}
      propertyCoords={propertyCoords}
      parkingMapInCover={property.parkingMapInCover}
      property={{
        checkInStart: property.checkInStart,
        checkInEnd: property.checkInEnd,
        checkOutTime: property.checkOutTime,
        isAutonomousCheckin: property.isAutonomousCheckin,
        hasBuildingAccess: property.hasBuildingAccess,
        hasParking: property.hasParking,
        hasAccessibilityConsiderations: property.hasAccessibilityConsiderations,
        buildingAccess: accessJson?.building ?? null,
        unitAccess: accessJson?.unit ?? null,
        primaryUnitMethod: property.primaryAccessMethod,
        parkingTypes: accessJson?.parking?.types ?? [],
        parkingCustomLabel: accessJson?.parking?.customLabel ?? null,
        parkingCustomDesc: accessJson?.parking?.customDesc ?? null,
        parkingPrimary: accessJson?.parking?.primary ?? null,
        accessibilityFeatures: accessJson?.accessibility?.features ?? [],
        accessibilityCustomLabel: accessJson?.accessibility?.customLabel ?? null,
        accessibilityCustomDesc: accessJson?.accessibility?.customDesc ?? null,
      }}
    />
  );
}
