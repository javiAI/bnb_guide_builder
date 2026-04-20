import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { ReservationForm } from "./reservation-form";
import { ReservationRow } from "./reservation-row";

export default async function ReservationsPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, propertyNickname: true, timezone: true },
  });
  if (!property) notFound();

  const reservations = await prisma.reservation.findMany({
    where: { propertyId },
    orderBy: [{ checkInDate: "asc" }],
    take: 200,
    select: {
      id: true,
      guestName: true,
      checkInDate: true,
      checkOutDate: true,
      numGuests: true,
      status: true,
      source: true,
      externalId: true,
      locale: true,
      _count: { select: { drafts: true } },
    },
  });

  const active = reservations.filter((r) => r.status !== "cancelled");
  const cancelled = reservations.filter((r) => r.status === "cancelled");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Reservas</h1>
          <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
            Reservas registradas manualmente. Al crearse, se materializan los
            drafts de las automations activas.
          </p>
        </div>
        <Link
          href={`/properties/${propertyId}/messaging/drafts`}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)]"
        >
          Ver drafts pendientes →
        </Link>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Nueva reserva
        </h2>
        <div className="mt-2">
          <ReservationForm propertyId={propertyId} />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Activas ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
            Aún no hay reservas.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {active.map((r) => (
              <ReservationRow
                key={r.id}
                reservation={{
                  id: r.id,
                  guestName: r.guestName,
                  checkInDate: r.checkInDate.toISOString().slice(0, 10),
                  checkOutDate: r.checkOutDate.toISOString().slice(0, 10),
                  numGuests: r.numGuests,
                  status: r.status,
                  source: r.source,
                  externalId: r.externalId,
                  locale: r.locale,
                  draftsCount: r._count.drafts,
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {cancelled.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-[var(--color-neutral-500)]">
            Canceladas ({cancelled.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {cancelled.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-sm opacity-75"
              >
                <div>
                  <p className="font-medium text-[var(--color-neutral-700)]">
                    {r.guestName}
                  </p>
                  <p className="text-xs text-[var(--color-neutral-500)]">
                    {r.checkInDate.toISOString().slice(0, 10)} →{" "}
                    {r.checkOutDate.toISOString().slice(0, 10)}
                  </p>
                </div>
                <Badge label="Cancelada" tone="neutral" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
