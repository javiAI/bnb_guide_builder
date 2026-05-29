import { notFound } from "next/navigation";
import {
  Cog,
  Check,
  CheckCheck,
  CircleDashed,
  Lightbulb,
  PenLine,
  TriangleAlert,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getSystemGroups, findSystemItem, findSystemSubtype } from "@/lib/taxonomy-loader";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { IconBadge } from "@/components/ui/icon-badge";
import { systemIconFor } from "@/lib/icons/system-icons";
import { CreateSystemForm } from "./create-system-form";
import { SystemRow, type SystemRowData } from "./_components/system-row";
import { RecommendedRow } from "./_components/recommended-row";
import { computeCompleteness } from "./_components/system-status";

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

  // One batched media query for the whole page (Q3): photos + videos per system.
  // MediaAssignment is scoped by entityId (not propertyId); mimeType lives on the
  // related MediaAsset, so it joins in the same query.
  const mediaRows = systemIds.length
    ? await prisma.mediaAssignment.findMany({
        where: { entityType: "system", entityId: { in: systemIds } },
        select: { entityId: true, mediaAsset: { select: { mimeType: true } } },
      })
    : [];
  const mediaByEntity = new Map<string, { photos: number; videos: number }>();
  for (const m of mediaRows) {
    const acc = mediaByEntity.get(m.entityId) ?? { photos: 0, videos: 0 };
    const mime = m.mediaAsset?.mimeType;
    if (mime?.startsWith("video/")) acc.videos += 1;
    else if (mime?.startsWith("image/")) acc.photos += 1;
    mediaByEntity.set(m.entityId, acc);
  }

  // Open incidents per system (Q8): one groupBy over Incident (targetType=system).
  const incidentRows = systemIds.length
    ? await prisma.incident.groupBy({
        by: ["targetId"],
        where: {
          propertyId,
          targetType: "system",
          status: { in: ["open", "in_progress"] },
          targetId: { in: systemIds },
        },
        _count: { _all: true },
      })
    : [];
  const incidentsByEntity = new Map<string, number>();
  for (const r of incidentRows) {
    if (r.targetId) incidentsByEntity.set(r.targetId, r._count._all);
  }

  const groups = getSystemGroups();
  const existingKeys = new Set(systems.map((s) => s.systemKey));
  const groupLabelByKey = new Map<string, string>();
  for (const g of groups) for (const item of g.items) groupLabelByKey.set(item.id, g.label);

  // Derive a row descriptor per installed system, bucketed by completeness.
  const configured: SystemRowData[] = [];
  const incomplete: SystemRowData[] = [];
  for (const sys of systems) {
    const item = findSystemItem(sys.systemKey);
    const subtype = findSystemSubtype(sys.systemKey);
    const details = (sys.detailsJson ?? {}) as Record<string, unknown>;
    const ops = (sys.opsJson ?? {}) as Record<string, unknown>;
    const c = computeCompleteness(subtype, details, ops);
    const media = mediaByEntity.get(sys.id) ?? { photos: 0, videos: 0 };
    const row: SystemRowData = {
      href: `/properties/${propertyId}/systems/${sys.id}`,
      icon: systemIconFor(sys.systemKey),
      title: item?.label ?? sys.systemKey,
      description: item?.description ?? null,
      groupLabel: groupLabelByKey.get(sys.systemKey) ?? "",
      status: c.status,
      pct: c.pct,
      fieldsFilled: c.filled,
      fieldsTotal: c.total,
      photos: media.photos,
      videos: media.videos,
      openIncidents: incidentsByEntity.get(sys.id) ?? 0,
      internal: sys.visibility === "internal",
    };
    if (c.status === "configured") configured.push(row);
    else incomplete.push(row);
  }

  // "Por configurar": recommended systems not yet installed (Q7 discovery).
  const recommended = groups
    .flatMap((g) => g.items.map((item) => ({ item, groupLabel: g.label })))
    .filter(({ item }) => item.recommended && !existingKeys.has(item.id));

  const installedCount = systems.length;
  const allConfigured = installedCount > 0 && configured.length === installedCount;
  const showTip = incomplete.length > 0 || recommended.length > 0;

  // Sections visible only when non-empty, EXCEPT "Por configurar" which is the
  // discovery affordance shown while any recommended system is uninstalled (Q7).
  const sections = [
    configured.length > 0 && { key: "configured" as const },
    incomplete.length > 0 && { key: "incomplete" as const },
    recommended.length > 0 && { key: "recommended" as const },
  ].filter(Boolean) as { key: "configured" | "incomplete" | "recommended" }[];
  const numFor = (key: string) =>
    String(sections.findIndex((s) => s.key === key) + 1).padStart(2, "0");

  return (
    <div>
      <PageHeader
        eyebrow="Propiedad · Sistemas"
        title="Sistemas de la casa"
        description="Climatización, agua caliente, electricidad y conectividad. Documenta lo que no es obvio: cada sistema se convierte en una tarjeta de la guía del huésped."
        actions={
          installedCount === 0 ? undefined : allConfigured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-status-success-bg)] px-3 py-1 text-[12px] font-medium text-[var(--color-status-success-text)]">
              <Check size={13} aria-hidden="true" />
              Todo configurado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-status-warning-bg)] px-3 py-1 text-[12px] font-medium text-[var(--color-status-warning-text)]">
              <TriangleAlert size={13} aria-hidden="true" />
              {configured.length} de {installedCount} configurados
            </span>
          )
        }
        chips={
          <>
            <PageHeaderChip icon={CheckCheck} value={configured.length} label="configurados" />
            <PageHeaderChip icon={PenLine} value={incomplete.length} label="incompletos" />
            <PageHeaderChip icon={CircleDashed} value={recommended.length} label="por configurar" />
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
              Cada sistema que configures se convierte en una tarjeta de la guía del huésped.
              Prioriza los recomendados —seguridad, agua caliente y conectividad— y añade fotos
              donde de verdad ayuden a quien llega.
            </p>
          </div>
        </div>
      )}

      {configured.length > 0 && (
        <NumberedSection number={numFor("configured")} title="Configurados">
          <div className="flex flex-col gap-2.5">
            {configured.map((row) => (
              <SystemRow key={row.href} {...row} />
            ))}
          </div>
        </NumberedSection>
      )}

      {incomplete.length > 0 && (
        <NumberedSection number={numFor("incomplete")} title="Incompletos">
          <div className="flex flex-col gap-2.5">
            {incomplete.map((row) => (
              <SystemRow key={row.href} {...row} />
            ))}
          </div>
        </NumberedSection>
      )}

      {recommended.length > 0 && (
        <NumberedSection number={numFor("recommended")} title="Por configurar">
          <div className="flex flex-col gap-2.5">
            {recommended.map(({ item, groupLabel }) => (
              <RecommendedRow
                key={item.id}
                propertyId={propertyId}
                systemKey={item.id}
                icon={systemIconFor(item.id)}
                title={item.label}
                description={item.description ?? null}
                groupLabel={groupLabel}
              />
            ))}
          </div>
        </NumberedSection>
      )}

      {installedCount === 0 && recommended.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-default)] px-8 py-12 text-center">
          <IconBadge icon={Cog} tone="neutral" size="md" iconSize={18} />
          <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            Aún no hay sistemas
          </p>
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            Añade el primero desde el selector de abajo.
          </p>
        </div>
      )}

      {/* Fallback: full grouped selector for any (incl. non-recommended) system (Q6). */}
      <div className="mt-4">
        <CreateSystemForm propertyId={propertyId} existingKeys={Array.from(existingKeys)} />
      </div>
    </div>
  );
}
