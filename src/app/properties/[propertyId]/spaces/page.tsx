import { notFound } from "next/navigation";
import Link from "next/link";
import { Camera, CheckCheck, DoorOpen, Info, Plus, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { ButtonLink } from "@/components/ui/button-link";
import { SpaceCard } from "./space-card";
import { CreateSpaceForm } from "./create-space-form";
import { resolveSpaceProgress, PROGRESS_PERCENT, type FeatureState } from "./space-progress";
import { spaceTypes, getSpaceTypeLabel, findSystemItem } from "@/lib/taxonomy-loader";
import { resolveSpaceAvailability } from "@/lib/services/space-availability.service";
import { loadSpaceCovers } from "@/lib/services/space-cover.service";
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
        layoutKey: true,
        propertyType: true,
        propertyEnvironment: true,
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

  const spaces = allSpaces.filter((s) => s.status !== "archived");
  const archivedSpaces = allSpaces.filter((s) => s.status === "archived");

  // Batched cover loader (one findMany for all spaces — no N+1).
  const covers = await loadSpaceCovers(allSpaces.map((s) => s.id));

  // Build default set respecting defaultCoverageRule from taxonomy:
  // - all_relevant_spaces: shown on all spaces by default (can be overridden)
  // - selected_spaces: only shown when explicitly override_yes
  // - property_only: never shown on space cards
  const defaultSystems = propertySystems.flatMap((sys) => {
    const item = findSystemItem(sys.systemKey);
    if (!item || item.defaultCoverageRule !== "all_relevant_spaces") return [];
    return [{ id: sys.id, systemKey: sys.systemKey, label: item.label }];
  });

  // Build map: spaceId → SpaceSystem[], starting from inherited defaults then applying overrides
  const systemsBySpace = new Map<string, { id: string; systemKey: string; label: string }[]>();
  for (const space of spaces) {
    systemsBySpace.set(space.id, [...defaultSystems]);
  }
  for (const coverage of systemCoverages) {
    const item = findSystemItem(coverage.system.systemKey);
    if (!item) continue;
    const spaceId = coverage.spaceId;
    const current = systemsBySpace.get(spaceId) ?? [];
    if (coverage.mode === "override_no") {
      systemsBySpace.set(spaceId, current.filter((s) => s.id !== coverage.system.id));
    } else if (
      coverage.mode === "override_yes" &&
      item.defaultCoverageRule !== "property_only" &&
      !current.some((s) => s.id === coverage.system.id)
    ) {
      current.push({ id: coverage.system.id, systemKey: coverage.system.systemKey, label: item.label });
      systemsBySpace.set(spaceId, current);
    }
  }

  // Compute available space types from roomType + layoutKey + overlays
  // (propertyType + propertyEnvironment). Treat missing roomType as unknown —
  // don't apply entire-place rules to legacy/incomplete properties.
  const { required, recommended, optional, excluded } = resolveSpaceAvailability({
    roomType: property.roomType ?? "",
    layoutKey: property.layoutKey ?? null,
    propertyType: property.propertyType ?? null,
    environment: property.propertyEnvironment ?? null,
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
  const totalPhotos = spaces.reduce((sum, s) => sum + (covers.get(s.id)?.photoCount ?? 0), 0);
  const completionPct =
    spaces.length === 0
      ? 0
      : Math.round(
          spaces.reduce((sum, s) => {
            const level = resolveSpaceProgress(
              s.spaceType,
              (s.featuresJson as FeatureState) ?? {},
              s.beds.length,
            );
            return sum + PROGRESS_PERCENT[level];
          }, 0) / spaces.length,
        );

  function renderCard(space: (typeof allSpaces)[number]) {
    return (
      <SpaceCard
        key={space.id}
        propertyId={propertyId}
        maxGuests={property!.maxGuests}
        coverThumbUrl={covers.get(space.id)?.coverUrl ?? null}
        photoCount={covers.get(space.id)?.photoCount ?? 0}
        space={{
          id: space.id,
          spaceType: space.spaceType,
          name: space.name,
          guestNotes: space.guestNotes,
          internalNotes: space.internalNotes,
          featuresJson: space.featuresJson as Record<string, unknown> | null,
          status: space.status === "archived" ? "archived" : "active",
        }}
        beds={space.beds.map((b) => ({
          id: b.id,
          bedType: b.bedType,
          quantity: b.quantity,
          configJson: b.configJson as Record<string, unknown> | null,
        }))}
        spaceSystems={space.status === "archived" ? [] : (systemsBySpace.get(space.id) ?? [])}
      />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Propiedad · Espacios"
        title="Espacios"
        description="Cada espacio tiene su ficha en la guía del huésped: una foto principal, dimensiones, camas y las peculiaridades que lo hacen único."
        actions={
          <ButtonLink href="#anadir-espacio">
            <Plus size={15} aria-hidden="true" />
            Añadir espacio
          </ButtonLink>
        }
        chips={
          <>
            <PageHeaderChip icon={DoorOpen} label={countChipLabel(spaces.length, "espacio", "espacios")} />
            <PageHeaderChip icon={Camera} label={countChipLabel(totalPhotos, "foto", "fotos")} />
            {spaces.length > 0 && (
              <PageHeaderChip icon={CheckCheck} label="Completado" value={`${completionPct}%`} />
            )}
          </>
        }
      />

      {/* Layout conflicts warning */}
      {conflictingSpaces.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-lg)] border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] px-4 py-3">
          <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-[var(--color-status-warning-icon)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-status-warning-text)]">Conflicto de distribución</p>
            <p className="mt-1 text-xs text-[var(--color-status-warning-text)]">
              Los siguientes espacios no son compatibles con la distribución actual y deberían eliminarse:{" "}
              <span className="font-medium">{conflictingSpaces.map((s) => s.name || getSpaceTypeLabel(s.spaceType)).join(", ")}</span>
            </p>
          </div>
        </div>
      )}

      {/* Capacity mismatch banner */}
      {capacityMismatch && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-lg)] border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] px-4 py-3">
          <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-[var(--color-status-warning-icon)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-status-warning-text)]">Capacidad insuficiente</p>
            <p className="mt-1 text-xs text-[var(--color-status-warning-text)]">
              Las camas configuradas permiten{" "}
              <span className="font-medium">{totalBedCapacity} {totalBedCapacity === 1 ? "huésped" : "huéspedes"}</span>
              {" "}pero el máximo de huéspedes es{" "}
              <span className="font-medium">{property.maxGuests}</span>.
              {" "}Añade más camas o reduce el máximo de huéspedes en{" "}
              <Link href={`/properties/${propertyId}/property`} className="font-medium text-[var(--color-text-link)] hover:underline">Propiedad</Link>.
            </p>
          </div>
        </div>
      )}

      {/* Missing required spaces hint */}
      {missingRequired.length > 0 && spaces.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-lg)] border border-[var(--color-status-info-border)] bg-[var(--color-status-info-bg)] px-4 py-3">
          <Info size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-[var(--color-status-info-icon)]" />
          <p className="text-xs text-[var(--color-status-info-text)]">
            Espacios obligatorios para este tipo de alojamiento aún no añadidos:{" "}
            <span className="font-medium">{missingRequired.map((id) => getSpaceTypeLabel(id)).join(", ")}</span>
          </p>
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
            {spaces.map(renderCard)}
          </div>
        )}
      </NumberedSection>

      <div id="anadir-espacio" className="scroll-mt-20">
        <NumberedSection number="02" title="Añadir espacio">
          <CreateSpaceForm propertyId={propertyId} availableTypeOptions={availableTypeOptions} />
        </NumberedSection>
      </div>

      {archivedSpaces.length > 0 && (
        <NumberedSection number="03" title={`Archivados (${archivedSpaces.length})`}>
          <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
            Los espacios archivados no cuentan en capacidad ni aparecen en la guía del huésped. Puedes restaurarlos en cualquier momento.
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
            {archivedSpaces.map(renderCard)}
          </div>
        </NumberedSection>
      )}
    </div>
  );
}
