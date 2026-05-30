import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LayoutGrid, LifeBuoy } from "lucide-react";
import { prisma } from "@/lib/db";
import { findSystemItem, findSystemSubtype } from "@/lib/taxonomy-loader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { TextLink } from "@/components/ui/text-link";
import { IconBadge } from "@/components/ui/icon-badge";
import { systemIconFor } from "@/lib/icons/system-icons";
import { groupLabelFor } from "../_components/system-taxonomy";
import { SEVERITY_BADGE } from "@/lib/troubleshooting-severity";
import { SystemDetailForm } from "./system-detail-form";
import { SystemCoverageTable } from "./system-coverage-table";
import { DeleteSystemButton } from "./delete-system-button";

export default async function SystemDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string; systemId: string }>;
}) {
  const { propertyId, systemId } = await params;

  const [system, spaces] = await Promise.all([
    prisma.propertySystem.findUnique({
      where: { id: systemId },
      include: { coverages: true },
    }),
    prisma.space.findMany({
      where: { propertyId, status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, spaceType: true },
    }),
  ]);

  if (!system || system.propertyId !== propertyId) notFound();

  const relatedPlaybooks = await prisma.troubleshootingPlaybook.findMany({
    where: { propertyId, systemKey: system.systemKey },
    select: { id: true, title: true, severity: true },
    orderBy: { title: "asc" },
  });

  const item = findSystemItem(system.systemKey);
  const subtype = findSystemSubtype(system.systemKey) ?? null;
  const SystemIcon = systemIconFor(system.systemKey);

  const groupLabel = groupLabelFor(system.systemKey) || null;

  const detailsJson = (system.detailsJson ?? {}) as Record<string, unknown>;
  const opsJson = (system.opsJson ?? {}) as Record<string, unknown>;

  // Build coverage map: spaceId → mode
  const coverageMap = new Map(system.coverages.map((c) => [c.spaceId, c.mode]));

  return (
    <div>
      <TextLink
        href={`/properties/${propertyId}/systems`}
        size="sm"
        className="mb-3 inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Sistemas
      </TextLink>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <IconBadge icon={SystemIcon} tone="neutral" size="md" iconSize={18} />
            {item?.label ?? system.systemKey}
          </span>
        }
        description={item?.description ?? undefined}
        actions={<DeleteSystemButton systemId={systemId} propertyId={propertyId} />}
        chips={
          <>
            {groupLabel && <PageHeaderChip label={groupLabel} />}
            <PageHeaderChip
              label="Visibilidad"
              value={system.visibility === "internal" ? "Solo interno" : "Huésped"}
            />
          </>
        }
      />

      <div className="flex flex-col gap-5">
        {/* Config-driven detail form (renders its own section cards) */}
        <SystemDetailForm
          systemId={systemId}
          propertyId={propertyId}
          subtype={subtype}
          detailsJson={detailsJson}
          opsJson={opsJson}
          internalNotes={system.internalNotes}
          visibility={system.visibility}
        />

        {/* Troubleshooting relacionado */}
        <Card variant="overview">
          <SectionEyebrow icon={LifeBuoy} className="mb-1">
            Troubleshooting relacionado
          </SectionEyebrow>
          <p className="mb-3 text-[12px] text-[var(--color-text-secondary)]">
            Playbooks vinculados a este sistema.
          </p>
          {relatedPlaybooks.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-muted)]">
              No hay playbooks vinculados a este sistema.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {relatedPlaybooks.map((pb) => {
                const sev = SEVERITY_BADGE[pb.severity] ?? SEVERITY_BADGE.medium;
                return (
                  <li key={pb.id}>
                    <Link
                      href={`/properties/${propertyId}/troubleshooting/${pb.id}`}
                      className="flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-default)] px-3 no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
                    >
                      <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                        {pb.title}
                      </span>
                      <Badge tone={sev.tone} label={sev.label} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Coverage table */}
        {spaces.length > 0 && (
          <Card variant="overview">
            <SectionEyebrow icon={LayoutGrid} className="mb-1">
              Cobertura por espacio
            </SectionEyebrow>
            <p className="mb-4 text-[12px] text-[var(--color-text-secondary)]">
              Indica si este sistema está disponible en cada espacio. Por defecto se hereda la
              configuración global.
            </p>
            <SystemCoverageTable
              systemId={systemId}
              propertyId={propertyId}
              spaces={spaces}
              coverageMap={Object.fromEntries(coverageMap)}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
