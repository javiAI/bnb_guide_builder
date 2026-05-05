import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { findIncidentCategory } from "@/lib/taxonomy-loader";
import type { BadgeTone } from "@/lib/types";

interface Props {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ origin?: string; status?: string }>;
}

const ORIGIN_FILTERS: { value: string | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "guest_guide", label: "Del huésped" },
  { value: "internal", label: "Internas" },
];

const STATUS_FILTERS: { value: string | "all"; label: string }[] = [
  { value: "all", label: "Cualquier estado" },
  { value: "open", label: "Abiertas" },
  { value: "in_progress", label: "En curso" },
  { value: "resolved", label: "Resueltas" },
  { value: "cancelled", label: "Canceladas" },
];

const STATUS_LABEL: Record<string, string> = {
  open: "Abierta",
  in_progress: "En curso",
  resolved: "Resuelta",
  cancelled: "Cancelada",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  open: "warning",
  in_progress: "neutral",
  resolved: "success",
  cancelled: "neutral",
};

const SEVERITY_LABEL: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const SEVERITY_TONE: Record<string, BadgeTone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function IncidentsPage({ params, searchParams }: Props) {
  const { propertyId } = await params;
  const sp = await searchParams;
  const originFilter = sp.origin ?? "all";
  const statusFilter = sp.status ?? "all";

  const where = {
    propertyId,
    ...(originFilter !== "all" ? { origin: originFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };

  const [property, incidents, guestCount] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    }),
    prisma.incident.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        origin: true,
        reporterType: true,
        categoryKey: true,
        targetType: true,
        createdAt: true,
      },
      take: 200,
    }),
    prisma.incident.count({
      where: { propertyId, origin: "guest_guide", status: "open" },
    }),
  ]);

  if (!property) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Incidencias
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Avisos del huésped y registro interno de operaciones.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge
          label={`${guestCount} del huésped abiertas`}
          tone={guestCount > 0 ? "warning" : "neutral"}
        />
        <Badge label={`${incidents.length} en lista`} tone="neutral" />
      </div>

      <div className="mt-6 flex flex-wrap gap-6">
        <FilterGroup
          name="origin"
          label="Origen"
          active={originFilter}
          options={ORIGIN_FILTERS}
          propertyId={propertyId}
          statusValue={statusFilter}
          originValue={originFilter}
        />
        <FilterGroup
          name="status"
          label="Estado"
          active={statusFilter}
          options={STATUS_FILTERS}
          propertyId={propertyId}
          statusValue={statusFilter}
          originValue={originFilter}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
        {incidents.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--color-neutral-500)]">
            No hay incidencias que coincidan con los filtros.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {incidents.map((incident) => {
              const category =
                incident.categoryKey !== null
                  ? findIncidentCategory(incident.categoryKey)
                  : null;
              return (
                <li key={incident.id}>
                  <Link
                    href={`/properties/${propertyId}/incidents/${incident.id}`}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-[var(--color-neutral-50)] focus:bg-[var(--color-neutral-50)] focus:outline-none"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-[var(--foreground)]">
                        {incident.title}
                      </span>
                      <span className="text-xs text-[var(--color-neutral-500)] whitespace-nowrap">
                        {formatDate(incident.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        label={
                          incident.origin === "guest_guide"
                            ? "Huésped"
                            : "Interno"
                        }
                        tone={
                          incident.origin === "guest_guide"
                            ? "warning"
                            : "neutral"
                        }
                      />
                      <Badge
                        label={STATUS_LABEL[incident.status] ?? incident.status}
                        tone={STATUS_TONE[incident.status] ?? "neutral"}
                      />
                      <Badge
                        label={SEVERITY_LABEL[incident.severity] ?? incident.severity}
                        tone={SEVERITY_TONE[incident.severity] ?? "neutral"}
                      />
                      {category && (
                        <span className="text-xs text-[var(--color-neutral-600)]">
                          {category.label}
                        </span>
                      )}
                      {!category && incident.targetType && (
                        <span className="text-xs text-[var(--color-neutral-500)]">
                          {incident.targetType}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

interface FilterGroupProps {
  name: "origin" | "status";
  label: string;
  active: string;
  options: { value: string; label: string }[];
  propertyId: string;
  statusValue: string;
  originValue: string;
}

function FilterGroup({
  name,
  label,
  active,
  options,
  propertyId,
  statusValue,
  originValue,
}: FilterGroupProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">
        {label}
      </span>
      <div className="flex gap-1">
        {options.map((opt) => {
          const nextOrigin = name === "origin" ? opt.value : originValue;
          const nextStatus = name === "status" ? opt.value : statusValue;
          const params = new URLSearchParams();
          if (nextOrigin !== "all") params.set("origin", nextOrigin);
          if (nextStatus !== "all") params.set("status", nextStatus);
          const qs = params.toString();
          const href = `/properties/${propertyId}/incidents${qs ? `?${qs}` : ""}`;
          const selected = active === opt.value;
          return (
            <Link
              key={opt.value}
              href={href}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                selected
                  ? "bg-[var(--color-primary-500)] text-white"
                  : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
