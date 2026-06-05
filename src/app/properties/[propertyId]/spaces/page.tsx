import { notFound } from "next/navigation";
import Link from "next/link";
import { Camera, CheckCheck, DoorOpen } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { Banner } from "@/components/ui/banner";
import { SpacesGrid, type SpaceCardData } from "./spaces-grid";
import { type SpaceCoverageSystem } from "./space-systems-coverage";
import { CreateSpaceForm } from "./create-space-form";
import { resolveSpaceStatus, type FeatureState } from "./space-progress";
import { spaceTypes, getSpaceTypeLabel, findSystemItem } from "@/lib/taxonomy-loader";
import { resolveSpaceAvailability } from "@/lib/services/space-availability.service";
import { loadSpaceMedia, spaceMediaOf } from "@/lib/services/space-media.service";
import { getBedSleepingCapacity } from "@/lib/property-counts";

/** Header chip label: bold count + pluralized noun (e.g. "5 espacios"). */
function countChipLabel(n: number, singular: string, plural: string) {
  return (
    <>
      <span className="font-semibold text-[var(--color-text-primary)]">{n}</span>{" "}
      {n === 1 ? singular : plural}
    </>
  );
}

export default async function SpacesPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const [property, allSpaces, propertySystems, systemCoverages] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        maxGuests: true,
        roomType: true,
        propertyType: true,
        propertyEnvironments: true,
        usableAreaSqm: true,
        ceilingHeightCm: true,
      },
    }),
    prisma.space.findMany({
      where: { propertyId },
      orderBy: { sortOrder: "asc" },
      include: { beds: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.propertySystem.findMany({
      where: { propertyId },
      select: { id: true, systemKey: true },
    }),
    prisma.propertySystemCoverage.findMany({
      where: { space: { propertyId } },
      include: { system: { select: { id: true, systemKey: true } } },
    }),
  ]);

  if (!property) notFound();

  // Archiving was removed (spaces are deleted, not archived) — show every
  // space in one grid. Any legacy archived row renders as a normal, deletable
  // card (it stays excluded from derived counts via the status filter in the
  // derivation services).
  const spaces = allSpaces;

  // Batched media loader (one findMany for all spaces — no N+1). Returns the
  // full ordered slide set per space so each card cover is a MediaCarousel.
  const media = await loadSpaceMedia(allSpaces.map((s) => s.id));

  // Per-space EDITABLE system coverage (Opción 1). Relevant systems = those that
  // can cover spaces (defaultCoverageRule != property_only); for each we resolve
  // the EFFECTIVE state (explicit override, else the taxonomy default) plus the
  // per-space note. This replaces the old read-only "systems in this space" list
  // — the operator now toggles coverage directly from the space editor.
  const spaceRelevantSystems = propertySystems.flatMap((sys) => {
    const item = findSystemItem(sys.systemKey);
    if (!item || item.defaultCoverageRule === "property_only") return [];
    return [{ id: sys.id, systemKey: sys.systemKey, label: item.label, defaultsOn: item.defaultCoverageRule === "all_relevant_spaces" }];
  });
  const coverageByKey = new Map<string, { mode: string; note: string | null }>();
  for (const c of systemCoverages) {
    coverageByKey.set(`${c.spaceId}|${c.systemId}`, { mode: c.mode, note: c.note ?? null });
  }
  function coverageFor(spaceId: string): SpaceCoverageSystem[] {
    return spaceRelevantSystems.map((sys) => {
      const cov = coverageByKey.get(`${spaceId}|${sys.id}`);
      const covered = cov?.mode === "override_yes" ? true : cov?.mode === "override_no" ? false : sys.defaultsOn;
      return { systemId: sys.id, systemKey: sys.systemKey, label: sys.label, covered, note: cov?.note ?? "", defaultsOn: sys.defaultsOn };
    });
  }

  // Compute available space types from roomType + overlays (propertyType +
  // propertyEnvironments). Treat missing roomType as unknown — don't apply
  // entire-place rules to legacy/incomplete properties.
  const { required, recommended, optional, excluded } = resolveSpaceAvailability({
    roomType: property.roomType ?? "",
    propertyType: property.propertyType ?? null,
    environments: property.propertyEnvironments,
  });

  const allAvailable = [...required, ...recommended, ...optional];
  const existingTypes = new Set(spaces.map((s) => s.spaceType));

  // Capacity: total sleeping places across all beds (uses sleepingCapacity from bed_types.json)
  const totalBedCapacity = spaces.reduce(
    (sum, s) =>
      sum +
      s.beds.reduce(
        (bsum, b) =>
          bsum +
          getBedSleepingCapacity(
            b.bedType,
            b.quantity,
            b.configJson as Record<string, unknown> | null,
          ),
        0,
      ),
    0,
  );
  const capacityMismatch =
    property.maxGuests != null && totalBedCapacity < property.maxGuests;

  // Spaces that conflict with current layout (in excluded list)
  const conflictingSpaces = spaces.filter((s) => excluded.includes(s.spaceType));

  // Required types not yet added
  const missingRequired = required.filter((id) => !existingTypes.has(id));

  // Build filtered space type options for the create form
  const availableTypeOptions = spaceTypes.items
    .filter((st) => allAvailable.includes(st.id) || allAvailable.length === 0)
    .map((st) => ({ id: st.id, label: st.label, recommended: recommended.includes(st.id) }));

  // ── Header chips (derived from real data) ──
  const totalPhotos = spaces.reduce((sum, s) => sum + spaceMediaOf(media, s.id).photoCount, 0);
  // Honest readiness: how many spaces meet every applicable signal (photo +
  // beds-if-sleeping + details). No fake average percentage.
  const readyCount = spaces.filter(
    (s) =>
      resolveSpaceStatus(
        s.spaceType,
        (s.featuresJson as FeatureState) ?? {},
        s.beds.length,
        spaceMediaOf(media, s.id).photoCount > 0,
      ) === "complete",
  ).length;

  const maxGuests = property.maxGuests;

  function toCard(space: (typeof allSpaces)[number]): SpaceCardData {
    const m = spaceMediaOf(media, space.id);
    return {
      space: {
        id: space.id,
        spaceType: space.spaceType,
        name: space.name,
        guestNotes: space.guestNotes,
        internalNotes: space.internalNotes,
        featuresJson: space.featuresJson as Record<string, unknown> | null,
        status: space.status === "archived" ? "archived" : "active",
      },
      beds: space.beds.map((b) => ({
        id: b.id,
        bedType: b.bedType,
        quantity: b.quantity,
        configJson: b.configJson as Record<string, unknown> | null,
      })),
      coverageSystems: space.status === "archived" ? [] : coverageFor(space.id),
      slides: m.slides,
      photoCount: m.photoCount,
      videoCount: m.videoCount,
    };
  }

  const activeCards = spaces.map(toCard);

  return (
    <div>
      <PageHeader
        eyebrow="Propiedad · Espacios"
        title="Espacios"
        description="Cada espacio tiene su ficha en la guía del huésped: una foto principal, dimensiones, camas y las peculiaridades que lo hacen único."
        chips={
          <>
            <PageHeaderChip icon={DoorOpen} label={countChipLabel(spaces.length, "espacio", "espacios")} />
            <PageHeaderChip icon={Camera} label={countChipLabel(totalPhotos, "foto", "fotos")} />
            {spaces.length > 0 && (
              <PageHeaderChip
                icon={CheckCheck}
                label={
                  <>
                    <span className="font-semibold text-[var(--color-text-primary)]">{readyCount}</span>{" "}
                    de {spaces.length} listos
                  </>
                }
              />
            )}
          </>
        }
      />

      {/* Layout conflicts warning */}
      {conflictingSpaces.length > 0 && (
        <div className="mb-4">
          <Banner
            type="warning"
            title="Conflicto de distribución"
            message={
              <>
                Los siguientes espacios no son compatibles con la distribución actual y deberían eliminarse:{" "}
                <span className="font-medium">{conflictingSpaces.map((s) => s.name || getSpaceTypeLabel(s.spaceType)).join(", ")}</span>
              </>
            }
          />
        </div>
      )}

      {/* Capacity mismatch banner */}
      {capacityMismatch && (
        <div className="mb-4">
          <Banner
            type="warning"
            title="Capacidad insuficiente"
            message={
              <>
                Las camas configuradas permiten{" "}
                <span className="font-medium">{totalBedCapacity} {totalBedCapacity === 1 ? "huésped" : "huéspedes"}</span>
                {" "}pero el máximo de huéspedes es{" "}
                <span className="font-medium">{property.maxGuests}</span>.
                {" "}Añade más camas o reduce el máximo de huéspedes en{" "}
                <Link href={`/properties/${propertyId}/property`} className="font-medium text-[var(--color-text-link)] hover:underline">Propiedad</Link>.
              </>
            }
          />
        </div>
      )}

      {/* Missing required spaces hint */}
      {missingRequired.length > 0 && spaces.length > 0 && (
        <div className="mb-4">
          <Banner
            type="info"
            message={
              <>
                Espacios obligatorios para este tipo de alojamiento aún no añadidos:{" "}
                <span className="font-medium">{missingRequired.map((id) => getSpaceTypeLabel(id)).join(", ")}</span>
              </>
            }
          />
        </div>
      )}

      <NumberedSection number="01" title="Espacios principales">
        {spaces.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] px-8 py-12 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[var(--color-action-primary-subtle)]">
              <DoorOpen size={20} aria-hidden="true" className="text-[var(--color-action-primary)]" />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Aún no hay espacios
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--color-text-secondary)]">
              Empieza por el primero. Cada espacio que añadas tendrá su propia ficha con fotos, dimensiones y detalles.
            </p>
          </div>
        ) : (
          <SpacesGrid
            propertyId={propertyId}
            maxGuests={maxGuests}
            propertyAreaSqm={property.usableAreaSqm}
            propertyCeilingCm={property.ceilingHeightCm}
            cards={activeCards}
          />
        )}
      </NumberedSection>

      <NumberedSection number="02" title="Añadir espacio">
        <CreateSpaceForm propertyId={propertyId} availableTypeOptions={availableTypeOptions} />
      </NumberedSection>
    </div>
  );
}
