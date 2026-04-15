import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  troubleshootingTaxonomy,
  findItem,
  findSystemItem,
  findAmenityItem,
  accessMethods,
  getItems,
} from "@/lib/taxonomy-loader";
import { PlaybookDetailForm } from "./playbook-detail-form";

export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string; playbookKey: string }>;
}) {
  const { propertyId, playbookKey } = await params;

  // playbookKey is the DB id here (route segment name is legacy)
  const [playbook, systems, amenityInstances, spaces] = await Promise.all([
    prisma.troubleshootingPlaybook.findUnique({ where: { id: playbookKey } }),
    prisma.propertySystem.findMany({
      where: { propertyId },
      select: { systemKey: true },
      distinct: ["systemKey"],
      orderBy: { systemKey: "asc" },
    }),
    prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      select: { amenityKey: true },
      distinct: ["amenityKey"],
      orderBy: { amenityKey: "asc" },
    }),
    prisma.space.findMany({
      where: { propertyId, status: "active" },
      select: { id: true, name: true, spaceType: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!playbook || playbook.propertyId !== propertyId) notFound();

  const typeInfo = findItem(troubleshootingTaxonomy, playbook.playbookKey);

  const systemOptions = systems
    .map((s) => {
      const item = findSystemItem(s.systemKey);
      return { value: s.systemKey, label: item?.label ?? s.systemKey };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const amenityOptions = amenityInstances
    .map((a) => {
      const item = findAmenityItem(a.amenityKey);
      return { value: a.amenityKey, label: item?.label ?? a.amenityKey };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const spaceOptions = spaces.map((s) => ({ value: s.id, label: s.name }));

  const accessOptions = getItems(accessMethods).map((a) => ({
    value: a.id,
    label: a.label,
  }));

  // Ensure the currently-linked target is always selectable, even if the
  // referenced system/amenity was removed or the space archived.
  if (playbook.systemKey && !systemOptions.some((o) => o.value === playbook.systemKey)) {
    const item = findSystemItem(playbook.systemKey);
    systemOptions.unshift({
      value: playbook.systemKey,
      label: `${item?.label ?? playbook.systemKey} (ya no configurado)`,
    });
  }
  if (playbook.amenityKey && !amenityOptions.some((o) => o.value === playbook.amenityKey)) {
    const item = findAmenityItem(playbook.amenityKey);
    amenityOptions.unshift({
      value: playbook.amenityKey,
      label: `${item?.label ?? playbook.amenityKey} (ya no configurado)`,
    });
  }
  if (playbook.spaceId && !spaceOptions.some((o) => o.value === playbook.spaceId)) {
    const archived = await prisma.space.findUnique({
      where: { id: playbook.spaceId },
      select: { id: true, name: true, propertyId: true },
    });
    if (archived && archived.propertyId === propertyId) {
      spaceOptions.unshift({ value: archived.id, label: `${archived.name} (archivado)` });
    }
  }

  let initialTargetType: "none" | "system" | "amenity" | "space" | "access" = "none";
  let initialTargetKey = "";
  if (playbook.systemKey) {
    initialTargetType = "system";
    initialTargetKey = playbook.systemKey;
  } else if (playbook.amenityKey) {
    initialTargetType = "amenity";
    initialTargetKey = playbook.amenityKey;
  } else if (playbook.spaceId) {
    initialTargetType = "space";
    initialTargetKey = playbook.spaceId;
  } else if (playbook.accessMethodKey) {
    initialTargetType = "access";
    initialTargetKey = playbook.accessMethodKey;
  }

  return (
    <div>
      <Link
        href={`/properties/${propertyId}/troubleshooting`}
        className="text-sm text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)]"
      >
        &larr; Volver a incidencias
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {playbook.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
          {typeInfo?.label ?? playbook.playbookKey}
        </p>
      </div>

      <div className="mt-8">
        <PlaybookDetailForm
          propertyId={propertyId}
          playbook={{
            id: playbook.id,
            title: playbook.title,
            severity: playbook.severity,
            symptomsMd: playbook.symptomsMd ?? "",
            guestStepsMd: playbook.guestStepsMd ?? "",
            internalStepsMd: playbook.internalStepsMd ?? "",
            escalationRule: playbook.escalationRule ?? "",
            visibility: playbook.visibility,
            targetType: initialTargetType,
            targetKey: initialTargetKey,
          }}
          targetOptions={{
            system: systemOptions,
            amenity: amenityOptions,
            space: spaceOptions,
            access: accessOptions,
          }}
        />
      </div>
    </div>
  );
}
