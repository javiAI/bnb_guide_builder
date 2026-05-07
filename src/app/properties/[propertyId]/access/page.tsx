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

const KIND_ORDER: Record<SubsystemSlide["kind"], number> = {
  image: 0,
  map: 1,
  video: 2,
};

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

  const [property, accessAssignments, legacyAccessPhotoCount, propertyMediaCount] =
    await Promise.all([
      prisma.property.findUnique({
        where: { id: propertyId },
        select: {
          id: true,
          publicSlug: true,
          streetAddress: true,
          checkInStart: true,
          checkInEnd: true,
          checkOutTime: true,
          accessMethodsJson: true,
          primaryAccessMethod: true,
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
      property={{
        checkInStart: property.checkInStart,
        checkInEnd: property.checkInEnd,
        checkOutTime: property.checkOutTime,
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
