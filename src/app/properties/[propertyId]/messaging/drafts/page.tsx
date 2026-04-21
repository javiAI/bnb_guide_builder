import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { DRAFT_STATUSES, type DraftStatus } from "@/lib/services/messaging-automation.service";
import { DraftCard } from "./draft-card";

const STATUS_LABELS: Record<DraftStatus, string> = {
  pending_review: "Pendientes de revisión",
  approved: "Aprobados",
  sent: "Enviados",
  skipped: "Omitidos",
  cancelled: "Cancelados",
  error: "Con error",
};

const DRAFTS_PAGE_LIMIT = 200;

export default async function DraftsPage({
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

  const drafts = await prisma.messageDraft.findMany({
    where: { propertyId },
    orderBy: [{ scheduledSendAt: "asc" }, { createdAt: "desc" }],
    take: DRAFTS_PAGE_LIMIT,
    select: {
      id: true,
      bodyMd: true,
      channelKey: true,
      scheduledSendAt: true,
      status: true,
      touchpointKey: true,
      createdAt: true,
      reservation: {
        select: {
          id: true,
          guestName: true,
          checkInDate: true,
          checkOutDate: true,
        },
      },
      automation: {
        select: {
          id: true,
          triggerType: true,
          touchpointKey: true,
        },
      },
    },
  });

  const byStatus = new Map<string, typeof drafts>();
  for (const d of drafts) {
    const arr = byStatus.get(d.status) ?? [];
    arr.push(d);
    byStatus.set(d.status, arr);
  }

  const pendingCount = byStatus.get("pending_review")?.length ?? 0;
  const approvedCount = byStatus.get("approved")?.length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Drafts de mensajes
          </h1>
          <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
            Mensajes materializados por las automations. Revisa, edita o aprueba
            antes del envío.
          </p>
        </div>
        <Link
          href={`/properties/${propertyId}/messaging`}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)]"
        >
          ← Plantillas
        </Link>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Badge
          label={`${pendingCount} pendientes`}
          tone={pendingCount > 0 ? "warning" : "neutral"}
        />
        <Badge
          label={`${approvedCount} aprobados`}
          tone={approvedCount > 0 ? "success" : "neutral"}
        />
      </div>

      <div className="mt-8 space-y-8">
        {DRAFT_STATUSES.map((status) => {
          const rows = byStatus.get(status);
          if (!rows || rows.length === 0) return null;
          return (
            <section key={status}>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {STATUS_LABELS[status]} ({rows.length})
              </h2>
              <ul className="mt-3 space-y-3">
                {rows.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    propertyId={propertyId}
                    draft={{
                      id: draft.id,
                      bodyMd: draft.bodyMd,
                      channelKey: draft.channelKey,
                      status: draft.status as DraftStatus,
                      touchpointKey:
                        draft.touchpointKey ?? draft.automation?.touchpointKey ?? null,
                      scheduledSendAt: draft.scheduledSendAt?.toISOString() ?? null,
                      reservation: draft.reservation
                        ? {
                            id: draft.reservation.id,
                            guestName: draft.reservation.guestName,
                            checkInDate: draft.reservation.checkInDate
                              .toISOString()
                              .slice(0, 10),
                            checkOutDate: draft.reservation.checkOutDate
                              .toISOString()
                              .slice(0, 10),
                          }
                        : null,
                      automation: draft.automation
                        ? { id: draft.automation.id, triggerType: draft.automation.triggerType }
                        : null,
                    }}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        {drafts.length === 0 && (
          <p className="text-sm text-[var(--color-neutral-500)]">
            Aún no hay drafts. Crea una reserva en{" "}
            <Link
              href={`/properties/${propertyId}/reservations`}
              className="underline"
            >
              Reservas
            </Link>{" "}
            para materializar los de las automations activas.
          </p>
        )}
      </div>
    </div>
  );
}
