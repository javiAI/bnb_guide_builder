import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { ACTION_LABELS, getEntityLabel } from "@/lib/audit-labels";

export default async function ActivityPage({
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

  const logs = await prisma.auditLog.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Registro de actividad
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Auditoría de cambios y accesos sensibles.
      </p>

      <div className="mt-8">
        {logs.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <p className="text-sm text-[var(--color-neutral-500)]">
              Sin actividad registrada todavía.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const entityLabel = getEntityLabel(log.entityType);
              const actionInfo = ACTION_LABELS[log.action as keyof typeof ACTION_LABELS] ?? { label: log.action, tone: "neutral" as const };

              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge label={actionInfo.label} tone={actionInfo.tone} />
                      <span className="text-sm text-[var(--foreground)]">
                        {entityLabel}
                      </span>
                      <span className="text-xs text-[var(--color-neutral-400)]">
                        {log.actor}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-neutral-400)]">
                      {log.entityId}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--color-neutral-400)]">
                    {log.createdAt.toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
