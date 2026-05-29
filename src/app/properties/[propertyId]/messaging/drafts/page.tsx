import { notFound } from "next/navigation";
import { Inbox } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { TextLink } from "@/components/ui/text-link";
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

  // Number only the non-empty status groups sequentially (01, 02, …).
  const visibleStatuses = DRAFT_STATUSES.filter(
    (status) => (byStatus.get(status)?.length ?? 0) > 0,
  );

  return (
    <div>
      <TextLink
        href={`/properties/${propertyId}/messaging`}
        size="sm"
        className="mb-3 inline-flex items-center gap-1"
      >
        ← Mensajería
      </TextLink>

      <PageHeader
        eyebrow="Mensajería"
        title="Borradores de mensajes"
        description="Mensajes materializados por las automatizaciones. Revisa, edita o aprueba antes del envío."
        chips={
          <>
            <PageHeaderChip
              label="Pendientes"
              value={pendingCount}
              className={
                pendingCount > 0
                  ? "border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]"
                  : undefined
              }
            />
            <PageHeaderChip
              label="Aprobados"
              value={approvedCount}
              className={
                approvedCount > 0
                  ? "border-[var(--color-status-success-border)] bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]"
                  : undefined
              }
            />
          </>
        }
      />

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] px-8 py-12 text-center">
          <Inbox size={22} aria-hidden="true" className="text-[var(--color-text-muted)]" />
          <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
            Aún no hay borradores. Crea una reserva en{" "}
            <TextLink href={`/properties/${propertyId}/reservations`} size="sm">
              Reservas
            </TextLink>{" "}
            para materializar los de las automatizaciones activas.
          </p>
        </div>
      ) : (
        <div className="mt-2">
          {visibleStatuses.map((status, idx) => {
            const rows = byStatus.get(status) ?? [];
            return (
              <NumberedSection
                key={status}
                number={String(idx + 1).padStart(2, "0")}
                title={`${STATUS_LABELS[status]} (${rows.length})`}
              >
                <ul className="space-y-3">
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
              </NumberedSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
