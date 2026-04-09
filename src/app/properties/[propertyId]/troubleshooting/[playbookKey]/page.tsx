import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { troubleshootingTaxonomy, findItem } from "@/lib/taxonomy-loader";
import { PlaybookDetailForm } from "./playbook-detail-form";

export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string; playbookKey: string }>;
}) {
  const { propertyId, playbookKey } = await params;

  // playbookKey is the DB id here (route segment name is legacy)
  const playbook = await prisma.troubleshootingPlaybook.findUnique({
    where: { id: playbookKey },
  });

  if (!playbook || playbook.propertyId !== propertyId) notFound();

  const typeInfo = findItem(troubleshootingTaxonomy, playbook.playbookKey);

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
          }}
        />
      </div>
    </div>
  );
}
