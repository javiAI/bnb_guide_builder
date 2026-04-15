import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { findSystemItem, findSystemSubtype } from "@/lib/taxonomy-loader";
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
  const subtype = system.systemKey ? findSystemSubtype(system.systemKey) : null;

  const detailsJson = (system.detailsJson ?? {}) as Record<string, unknown>;
  const opsJson = (system.opsJson ?? {}) as Record<string, unknown>;

  // Build coverage map: spaceId → mode
  const coverageMap = new Map(system.coverages.map((c) => [c.spaceId, c.mode]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={`/properties/${propertyId}/systems`}
            className="text-xs text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)]"
          >
            ← Sistemas
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
            {item?.label ?? system.systemKey}
          </h1>
          {item?.description && (
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">{item.description}</p>
          )}
        </div>
        <DeleteSystemButton systemId={systemId} propertyId={propertyId} />
      </div>

      <div className="space-y-6">
        {/* Config-driven detail form */}
        {subtype && (subtype.detailsFields.length > 0 || subtype.opsFields.length > 0) ? (
          <SystemDetailForm
            systemId={systemId}
            propertyId={propertyId}
            subtype={subtype}
            detailsJson={detailsJson}
            opsJson={opsJson}
            internalNotes={system.internalNotes}
            visibility={system.visibility}
          />
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
            <SystemDetailForm
              systemId={systemId}
              propertyId={propertyId}
              subtype={null}
              detailsJson={detailsJson}
              opsJson={opsJson}
              internalNotes={system.internalNotes}
              visibility={system.visibility}
            />
          </div>
        )}

        {/* Troubleshooting relacionado */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <h2 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
            Troubleshooting relacionado
          </h2>
          <p className="mb-3 text-xs text-[var(--color-neutral-500)]">
            Playbooks vinculados a este sistema.
          </p>
          {relatedPlaybooks.length === 0 ? (
            <p className="text-xs text-[var(--color-neutral-400)]">
              No hay playbooks vinculados a este sistema.
            </p>
          ) : (
            <ul className="space-y-2">
              {relatedPlaybooks.map((pb) => (
                <li key={pb.id}>
                  <Link
                    href={`/properties/${propertyId}/troubleshooting/${pb.id}`}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--color-neutral-50)]"
                  >
                    <span className="font-medium text-[var(--foreground)]">{pb.title}</span>
                    <span className="text-xs text-[var(--color-neutral-500)]">{pb.severity}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Coverage table */}
        {spaces.length > 0 && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--foreground)]">Cobertura por espacio</h2>
            <p className="mb-4 text-xs text-[var(--color-neutral-500)]">
              Indica si este sistema está disponible en cada espacio. Por defecto se hereda la configuración global.
            </p>
            <SystemCoverageTable
              systemId={systemId}
              propertyId={propertyId}
              spaces={spaces}
              coverageMap={Object.fromEntries(coverageMap)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
