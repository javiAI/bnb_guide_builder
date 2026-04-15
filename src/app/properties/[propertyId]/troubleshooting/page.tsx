import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { troubleshootingTaxonomy, findItem } from "@/lib/taxonomy-loader";
import { SEVERITY_BADGE } from "@/lib/troubleshooting-severity";
import { CreatePlaybookForm } from "./create-playbook-form";

export default async function TroubleshootingPage({
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

  const playbooks = await prisma.troubleshootingPlaybook.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Incidencias
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Playbooks de resolución de incidencias frecuentes.
      </p>

      <div className="mt-8">
        {playbooks.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Sin playbooks definidos
            </h2>
            <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
              Crea el primer playbook para documentar cómo resolver incidencias comunes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {playbooks.map((pb) => {
              const typeInfo = findItem(troubleshootingTaxonomy, pb.playbookKey);
              const severity = SEVERITY_BADGE[pb.severity] ?? SEVERITY_BADGE.medium;
              return (
                <Link
                  key={pb.id}
                  href={`/properties/${propertyId}/troubleshooting/${pb.id}`}
                  className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 transition-shadow hover:shadow-sm"
                >
                  <div>
                    <h3 className="text-sm font-medium text-[var(--foreground)]">
                      {pb.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
                      {typeInfo?.label ?? pb.playbookKey}
                    </p>
                  </div>
                  <Badge label={severity.label} tone={severity.tone} />
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Añadir playbook
          </h2>
          <CreatePlaybookForm propertyId={propertyId} />
        </div>
      </div>
    </div>
  );
}
