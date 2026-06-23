import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { findSystemItem, findSystemSubtype } from "@/lib/taxonomy-loader";
import { SPACE_SYSTEM_BLACKLIST } from "@/lib/taxonomies/systems";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { TextLink } from "@/components/ui/text-link";
import { IconBadge } from "@/components/ui/icon-badge";
import { DeleteConfirmationButton } from "@/components/ui/delete-confirmation-button";
import { systemIconFor } from "@/lib/icons/system-icons";
import { deleteSystemAction } from "@/lib/actions/editor.actions";
import { groupLabelFor } from "../_components/system-taxonomy";
import { computeCompleteness } from "../_components/system-status";
import { SEVERITY_BADGE } from "@/lib/troubleshooting-severity";
import { SystemDetailForm } from "./system-detail-form";
import { SystemCoverageTable } from "./system-coverage-table";

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

  const { filled, total } = computeCompleteness(subtype, detailsJson, opsJson);

  // Coverage hides for building/property-infrastructure systems (elevator,
  // refuse) that never belong to a single room. `all_relevant_spaces` ⇒ each
  // space defaults ON.
  const showCoverage = spaces.length > 0 && !SPACE_SYSTEM_BLACKLIST.has(system.systemKey);
  const defaultsOn = item?.defaultCoverageRule === "all_relevant_spaces";

  // spaceId → mode + note (existing overrides), for the coverage table.
  const coverageMap = Object.fromEntries(system.coverages.map((c) => [c.spaceId, c.mode]));
  const noteMap = Object.fromEntries(
    system.coverages.filter((c) => c.note).map((c) => [c.spaceId, c.note as string]),
  );

  // Dynamic section numbering: details (if any) · ops (if any) · settings
  // (always) · coverage (if shown) · solutions. The form owns 01–03; the page
  // owns the rest.
  let sectionNum = 0;
  const nextNum = () => String(++sectionNum).padStart(2, "0");
  const detailsNumber = subtype && subtype.detailsFields.length > 0 ? nextNum() : undefined;
  const opsNumber = subtype && subtype.opsFields.length > 0 ? nextNum() : null;
  const settingsNumber = nextNum();
  const coverageNumber = showCoverage ? nextNum() : null;
  const solutionsNumber = nextNum();

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
        eyebrow={groupLabel ? `Sistemas · ${groupLabel}` : "Sistemas"}
        title={
          <span className="inline-flex items-center gap-3">
            <IconBadge icon={SystemIcon} tone="neutral" size="md" iconSize={18} />
            {item?.label ?? system.systemKey}
          </span>
        }
        description={item?.description ?? undefined}
        actions={
          <DeleteConfirmationButton
            title="Eliminar sistema"
            description="Se perderá la ficha, su cobertura por espacio y los datos de operaciones. Los sistemas se pueden volver a añadir desde el catálogo."
            entityId={systemId}
            fieldName="systemId"
            action={deleteSystemAction}
            triggerLabel="Eliminar sistema"
          />
        }
        chips={
          <>
            {groupLabel && <PageHeaderChip label={groupLabel} />}
            {total > 0 && (
              <PageHeaderChip
                label={
                  <>
                    <span className="font-semibold text-[var(--color-text-primary)]">{filled}</span>{" "}
                    de {total} campos
                  </>
                }
              />
            )}
          </>
        }
      />

      <div className="flex flex-col gap-5">
        {/* Config-driven detail form — renders sections 01–03 (details / ops /
           settings) as its own NumberedSection cards. */}
        <SystemDetailForm
          systemId={systemId}
          propertyId={propertyId}
          subtype={subtype}
          detailsJson={detailsJson}
          opsJson={opsJson}
          internalNotes={system.internalNotes}
          visibility={system.visibility}
          detailsNumber={detailsNumber}
          opsNumber={opsNumber}
          settingsNumber={settingsNumber}
        />

        {coverageNumber && (
          <NumberedSection number={coverageNumber} title="Cobertura por espacio" className="mb-0">
            <Card variant="overview">
              <p className="mb-4 text-[12px] text-[var(--color-text-secondary)]">
                Indica si este sistema llega a cada espacio. Por defecto se hereda la configuración global.
              </p>
              <SystemCoverageTable
                systemId={systemId}
                spaces={spaces}
                coverageMap={coverageMap}
                noteMap={noteMap}
                defaultsOn={defaultsOn}
              />
            </Card>
          </NumberedSection>
        )}

        <NumberedSection number={solutionsNumber} title="Soluciones relacionadas" className="mb-0">
          <Card variant="overview">
            <p className="mb-3 text-[12px] text-[var(--color-text-secondary)]">
              Guías para resolver problemas de este sistema.
            </p>
            {relatedPlaybooks.length === 0 ? (
              <p className="text-[12px] text-[var(--color-text-muted)]">
                Aún no hay soluciones para este sistema. Créalas en{" "}
                <TextLink href={`/properties/${propertyId}/troubleshooting`} size="sm">
                  Soluciones
                </TextLink>
                .
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {relatedPlaybooks.map((pb) => {
                  const sev = SEVERITY_BADGE[pb.severity] ?? SEVERITY_BADGE.medium;
                  return (
                    <li key={pb.id}>
                      <Link
                        href={`/properties/${propertyId}/troubleshooting#playbook-${pb.id}`}
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
        </NumberedSection>
      </div>
    </div>
  );
}
