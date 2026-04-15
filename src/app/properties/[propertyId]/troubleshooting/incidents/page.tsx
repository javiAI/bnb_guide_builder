import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  findSystemItem,
  findAmenityItem,
  accessMethods,
  findItem,
  getItems,
} from "@/lib/taxonomy-loader";
import { SEVERITY_BADGE } from "@/lib/troubleshooting-severity";
import { formatInPropertyTZ } from "@/lib/property-timezone";
import { TroubleshootingTabs } from "../troubleshooting-tabs";
import { CreateIncidentForm } from "./create-incident-form";
import { IncidentRowActions } from "./incident-row-actions";

const STATUS_BADGE: Record<string, { label: string; tone: "neutral" | "warning" | "danger" | "success" }> = {
  open: { label: "Abierta", tone: "danger" },
  in_progress: { label: "En curso", tone: "warning" },
  resolved: { label: "Resuelta", tone: "success" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

function formatTarget(
  targetType: string,
  targetId: string | null,
  maps: {
    systems: Map<string, string>;
    amenities: Map<string, string>;
    spaces: Map<string, string>;
  },
): string {
  if (targetType === "property") return "Propiedad (general)";
  if (!targetId) return targetType;
  if (targetType === "system") {
    const item = maps.systems.get(targetId);
    return `Sistema · ${item ?? targetId}`;
  }
  if (targetType === "amenity") {
    const item = maps.amenities.get(targetId);
    return `Amenity · ${item ?? targetId}`;
  }
  if (targetType === "space") {
    const item = maps.spaces.get(targetId);
    return `Espacio · ${item ?? targetId}`;
  }
  if (targetType === "access") {
    const item = findItem(accessMethods, targetId);
    return `Acceso · ${item?.label ?? targetId}`;
  }
  return targetType;
}

export default async function IncidentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ targetType?: string; status?: string }>;
}) {
  const { propertyId } = await params;
  const { targetType: filterType, status: filterStatus } = await searchParams;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, timezone: true },
  });
  if (!property) notFound();

  const [incidents, systems, amenities, spaces, playbooks] = await Promise.all([
    prisma.incident.findMany({
      where: {
        propertyId,
        ...(filterType ? { targetType: filterType } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
      },
      orderBy: { occurredAt: "desc" },
      include: { playbook: { select: { id: true, title: true } } },
    }),
    prisma.propertySystem.findMany({
      where: { propertyId },
      select: { id: true, systemKey: true },
    }),
    prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      select: { id: true, amenityKey: true },
    }),
    prisma.space.findMany({
      where: { propertyId, status: "active" },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.troubleshootingPlaybook.findMany({
      where: { propertyId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const systemLabel = new Map(
    systems.map((s) => [s.id, findSystemItem(s.systemKey)?.label ?? s.systemKey]),
  );
  const amenityLabel = new Map(
    amenities.map((a) => [a.id, findAmenityItem(a.amenityKey)?.label ?? a.amenityKey]),
  );
  const spaceLabel = new Map(spaces.map((s) => [s.id, s.name]));

  const systemOptions = systems
    .map((s) => ({ value: s.id, label: findSystemItem(s.systemKey)?.label ?? s.systemKey }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const amenityOptions = amenities
    .map((a) => ({ value: a.id, label: findAmenityItem(a.amenityKey)?.label ?? a.amenityKey }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const spaceOptions = spaces.map((s) => ({ value: s.id, label: s.name }));
  const accessOptions = getItems(accessMethods).map((a) => ({ value: a.id, label: a.label }));
  const playbookOptions = playbooks.map((p) => ({ value: p.id, label: p.title }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Incidencias</h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Registro de ocurrencias reales. Filtrable por objetivo y estado.
      </p>

      <TroubleshootingTabs propertyId={propertyId} active="incidents" />

      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        <form className="flex gap-2">
          <label htmlFor="filter-targetType">
            <span className="sr-only">Objetivo</span>
            <select
              id="filter-targetType"
              name="targetType"
              defaultValue={filterType ?? ""}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1"
            >
              <option value="">Todos los objetivos</option>
              <option value="property">Propiedad</option>
              <option value="system">Sistema</option>
              <option value="amenity">Amenity</option>
              <option value="space">Espacio</option>
              <option value="access">Acceso</option>
            </select>
          </label>
          <label htmlFor="filter-status">
            <span className="sr-only">Estado</span>
            <select
              id="filter-status"
              name="status"
              defaultValue={filterStatus ?? ""}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1"
            >
              <option value="">Todos los estados</option>
              <option value="open">Abiertas</option>
              <option value="in_progress">En curso</option>
              <option value="resolved">Resueltas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-3 py-1 text-white hover:bg-[var(--color-primary-600)]"
          >
            Filtrar
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-3">
        {incidents.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-10 text-center">
            <p className="text-sm text-[var(--color-neutral-500)]">
              No hay ocurrencias registradas con estos filtros.
            </p>
          </div>
        ) : (
          incidents.map((inc) => {
            const sev = SEVERITY_BADGE[inc.severity] ?? SEVERITY_BADGE.medium;
            const st = STATUS_BADGE[inc.status] ?? STATUS_BADGE.open;
            return (
              <div
                key={inc.id}
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-[var(--foreground)]">{inc.title}</h3>
                      <Badge label={st.label} tone={st.tone} />
                      <Badge label={sev.label} tone={sev.tone} />
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
                      {formatTarget(inc.targetType, inc.targetId, {
                        systems: systemLabel,
                        amenities: amenityLabel,
                        spaces: spaceLabel,
                      })}
                      {" · "}
                      {formatInPropertyTZ(inc.occurredAt, property.timezone)}
                      {inc.playbook && (
                        <>
                          {" · Playbook: "}
                          <span className="text-[var(--foreground)]">{inc.playbook.title}</span>
                        </>
                      )}
                    </p>
                    {inc.notes && (
                      <p className="mt-2 text-sm text-[var(--color-neutral-700)]">{inc.notes}</p>
                    )}
                  </div>
                  <IncidentRowActions
                    incidentId={inc.id}
                    canResolve={inc.status !== "resolved" && inc.status !== "cancelled"}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-8">
        <CreateIncidentForm
          propertyId={propertyId}
          targetOptions={{
            system: systemOptions,
            amenity: amenityOptions,
            space: spaceOptions,
            access: accessOptions,
          }}
          playbookOptions={playbookOptions}
        />
      </div>
    </div>
  );
}
