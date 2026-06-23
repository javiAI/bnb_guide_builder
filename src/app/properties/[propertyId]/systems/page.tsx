import { notFound } from "next/navigation";
import { Cog, Camera, CheckCheck, Lightbulb } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSystemGroups, findSystemItem, findSystemSubtype } from "@/lib/taxonomy-loader";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip, countChipLabel } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { IconBadge } from "@/components/ui/icon-badge";
import { systemIconFor } from "@/lib/icons/system-icons";
import type { AddEntityChipGroup } from "@/components/ui/add-entity-chips";
import { AddSystemChips } from "./add-system-chips";
import { SystemRow, type SystemRowData } from "./_components/system-row";
import {
  computeCompleteness,
  missingSystemFieldLabels,
  formatMissingDetail,
} from "./_components/system-status";
import { groupLabelFor } from "./_components/system-taxonomy";

export default async function SystemsPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) notFound();

  const systems = await prisma.propertySystem.findMany({
    where: { propertyId },
    orderBy: { createdAt: "asc" },
  });
  const systemIds = systems.map((s) => s.id);

  // Two batched, independent queries that both depend only on systemIds, run in
  // parallel (media + open incidents):
  //  - media: photos + videos per system. MediaAssignment is scoped by entityId
  //    (not propertyId); mimeType lives on the related MediaAsset (same query).
  //  - incidents: open incidents per system via one groupBy over Incident.
  const [mediaRows, incidentRows] = await Promise.all([
    systemIds.length
      ? prisma.mediaAssignment.findMany({
          where: { entityType: "system", entityId: { in: systemIds } },
          select: { entityId: true, mediaAsset: { select: { mimeType: true } } },
        })
      : Promise.resolve([]),
    systemIds.length
      ? prisma.incident.groupBy({
          by: ["targetId"],
          where: {
            propertyId,
            targetType: "system",
            status: { in: ["open", "in_progress"] },
            targetId: { in: systemIds },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const mediaByEntity = new Map<string, { photos: number; videos: number }>();
  for (const m of mediaRows) {
    const acc = mediaByEntity.get(m.entityId) ?? { photos: 0, videos: 0 };
    const mime = m.mediaAsset?.mimeType;
    if (mime?.startsWith("video/")) acc.videos += 1;
    else if (mime?.startsWith("image/")) acc.photos += 1;
    mediaByEntity.set(m.entityId, acc);
  }

  const incidentsByEntity = new Map<string, number>();
  for (const r of incidentRows) {
    if (r.targetId) incidentsByEntity.set(r.targetId, r._count._all);
  }

  const groups = getSystemGroups();
  const existingKeys = new Set(systems.map((s) => s.systemKey));

  // One stable list of installed systems (createdAt asc), each carrying its
  // canonical status + missing-field hover detail. No buckets, no reorder.
  let configuredCount = 0;
  let totalPhotos = 0;
  const rows: SystemRowData[] = systems.map((sys) => {
    const item = findSystemItem(sys.systemKey);
    const subtype = findSystemSubtype(sys.systemKey);
    const details = (sys.detailsJson ?? {}) as Record<string, unknown>;
    const ops = (sys.opsJson ?? {}) as Record<string, unknown>;
    const c = computeCompleteness(subtype, details, ops);
    if (c.status === "configured") configuredCount += 1;
    const media = mediaByEntity.get(sys.id) ?? { photos: 0, videos: 0 };
    totalPhotos += media.photos;
    const statusDetail =
      c.status === "configured"
        ? undefined
        : formatMissingDetail(missingSystemFieldLabels(subtype, details, ops));
    return {
      href: `/properties/${propertyId}/systems/${sys.id}`,
      icon: systemIconFor(sys.systemKey),
      title: item?.label ?? sys.systemKey,
      description: item?.description ?? null,
      groupLabel: groupLabelFor(sys.systemKey),
      status: c.status,
      statusDetail,
      fieldsFilled: c.filled,
      fieldsTotal: c.total,
      photos: media.photos,
      videos: media.videos,
      openIncidents: incidentsByEntity.get(sys.id) ?? 0,
      internal: sys.visibility === "internal",
    };
  });

  // Add-chip groups: "Recomendados" first, then one per taxonomy group. An item
  // appears in exactly one group (recommended ones only under Recomendados).
  // `managedInProperty` systems (sys.elevator) are governed from Propiedad and
  // never offered here.
  const isAddable = (id: string, recommended: boolean, managed: boolean | undefined) =>
    !existingKeys.has(id) && !recommended && !managed;
  const recommendedItems = groups
    .flatMap((g) => g.items)
    .filter((i) => i.recommended && !existingKeys.has(i.id) && !i.managedInProperty)
    .map((i) => ({ id: i.id, label: i.label }));
  const addGroups: AddEntityChipGroup[] = [
    { label: "Recomendados", items: recommendedItems },
    ...groups.map((g) => ({
      label: g.label,
      items: g.items
        .filter((i) => isAddable(i.id, i.recommended, i.managedInProperty))
        .map((i) => ({ id: i.id, label: i.label })),
    })),
  ];

  const installedCount = systems.length;
  const pendingAddable = addGroups.reduce((sum, g) => sum + g.items.length, 0);
  const showTip = installedCount > 0 ? configuredCount < installedCount || pendingAddable > 0 : pendingAddable > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Propiedad · Sistemas"
        title="Sistemas de la casa"
        description="Climatización, agua caliente, electricidad y conectividad: cada sistema se convierte en una tarjeta de la guía del huésped."
        chips={
          <>
            <PageHeaderChip icon={Cog} label={countChipLabel(installedCount, "sistema", "sistemas")} />
            <PageHeaderChip icon={Camera} label={countChipLabel(totalPhotos, "foto", "fotos")} />
            {installedCount > 0 && (
              <PageHeaderChip
                icon={CheckCheck}
                label={
                  <>
                    <span className="font-semibold text-[var(--color-text-primary)]">{configuredCount}</span>{" "}
                    de {installedCount} listos
                  </>
                }
              />
            )}
          </>
        }
      />

      {showTip && (
        <div className="mb-8 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4">
          <IconBadge icon={Lightbulb} tone="primary" size="md" iconSize={17} />
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">
              Documenta lo que no se ve a simple vista
            </p>
            <p className="max-w-[68ch] text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              Prioriza seguridad, agua caliente y conectividad, y añade fotos donde de verdad ayuden a
              quien llega.
            </p>
          </div>
        </div>
      )}

      <NumberedSection number="01" title="Sistemas de la propiedad">
        {installedCount === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] px-8 py-12 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[var(--color-action-primary-subtle)]">
              <Cog size={20} aria-hidden="true" className="text-[var(--color-action-primary)]" />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Aún no hay sistemas
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--color-text-secondary)]">
              Empieza por los recomendados: cada sistema que añadas tendrá su ficha con instrucciones y fotos.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <SystemRow key={row.href} {...row} />
            ))}
          </div>
        )}
      </NumberedSection>

      <NumberedSection number="02" title="Añadir sistema">
        <AddSystemChips propertyId={propertyId} groups={addGroups} />
      </NumberedSection>
    </div>
  );
}
