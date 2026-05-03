import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  MapPin,
  UsersRound,
  BedDouble,
  Bed,
  Bath,
  History,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/db";
import {
  STATUS_LABELS,
  STATUS_TONES,
  type PropertyStatus,
  type BadgeTone,
} from "@/lib/types";
import { getDerived } from "@/lib/services/property-derived.service";
import { runAllValidations } from "@/lib/validations/run-all";
import { getSpaceTypeLabel } from "@/lib/taxonomy-loader";
import { ACTION_LABELS, getEntityLabel } from "@/lib/audit-labels";
import { formatRelativeEs } from "@/lib/format-relative-es";
import { ReadinessHeroCard } from "@/components/overview/readiness-hero-card";
import { KpiStrip } from "@/components/overview/kpi-strip";
import { TasksListCard } from "@/components/overview/tasks-list-card";
import {
  ActivityFeedCard,
  type ActivityFeedItem,
} from "@/components/overview/activity-feed-card";
import {
  SpacesTableCard,
  type SpacesTableRow,
} from "@/components/overview/spaces-table-card";
import { ChipRow } from "@/components/overview/chip-row";

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

const STATUS_PILL_BG: Record<BadgeTone, string> = {
  neutral:
    "bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]",
  success:
    "bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]",
  warning:
    "bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]",
  danger: "bg-[var(--badge-error-bg)] text-[var(--badge-error-fg)]",
};

function formatActivityMessage(
  entityType: string,
  action: string,
): { message: string; tone?: ActivityFeedItem["tone"] } {
  const entity = getEntityLabel(entityType);
  const info = ACTION_LABELS[action as keyof typeof ACTION_LABELS];
  if (!info) return { message: `${entity} · ${action}` };
  return { message: `${entity} ${info.verbPast}`, tone: info.tone };
}

interface ChipProps {
  icon: LucideIcon;
  label?: string;
  emphasis?: string;
}

function Chip({ icon: Icon, label, emphasis }: ChipProps) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-2.5 py-1 text-[12px] text-[var(--color-text-secondary)]">
      <Icon size={12} aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]" />
      {label && <span>{label}</span>}
      {emphasis && (
        <span className="font-semibold text-[var(--color-text-primary)]">{emphasis}</span>
      )}
    </span>
  );
}

interface SectionHeadingProps {
  num: string;
  title: string;
  action?: { label: string; href: string };
}

function SectionHeading({ num, title, action }: SectionHeadingProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-3 text-[15px] font-semibold text-[var(--color-text-primary)]">
        <span
          aria-hidden="true"
          className="grid h-[22px] min-w-[22px] place-items-center rounded-[6px] bg-[var(--color-background-muted)] px-1.5 text-[10px] font-semibold tabular-nums tracking-wider text-[var(--color-text-secondary)]"
        >
          {num}
        </span>
        {title}
      </h2>
      {action && (
        <Link
          href={action.href}
          className="text-[12px] font-medium text-[var(--color-text-link)] hover:underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      propertyNickname: true,
      city: true,
      country: true,
      status: true,
      maxGuests: true,
      bedroomsCount: true,
      bathroomsCount: true,
      bedsCount: true,
      infantsAllowed: true,
      accessMethodsJson: true,
      updatedAt: true,
    },
  });

  if (!property) notFound();

  const [derived, validations, spacesRaw, amenityCount, contactsCount, auditEntries] =
    await Promise.all([
      getDerived(propertyId),
      runAllValidations(propertyId, {
        maxGuests: property.maxGuests,
        infantsAllowed: property.infantsAllowed,
        accessMethodsJson: property.accessMethodsJson,
      }),
      prisma.space.findMany({
        where: { propertyId, status: "active" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          spaceType: true,
          updatedAt: true,
          _count: { select: { amenityPlacements: true } },
        },
      }),
      prisma.propertyAmenityInstance.count({ where: { propertyId } }),
      prisma.contact.count({ where: { propertyId } }),
      prisma.auditLog.findMany({
        where: { propertyId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          entityType: true,
          action: true,
          createdAt: true,
        },
      }),
    ]);

  const spaceIds = spacesRaw.map((s) => s.id);
  const photoCounts = spaceIds.length
    ? await prisma.mediaAssignment.groupBy({
        by: ["entityId"],
        where: { entityType: "space", entityId: { in: spaceIds } },
        _count: { entityId: true },
      })
    : [];
  const photoByEntity = new Map(
    photoCounts.map((p) => [p.entityId, p._count.entityId]),
  );

  const { readiness } = derived;
  const status = property.status as PropertyStatus;
  const statusTone = STATUS_TONES[status];
  const statusLabel = STATUS_LABELS[status];

  const location = [property.city, property.country].filter(Boolean).join(", ");
  const lastEditedRel = formatRelativeEs(property.updatedAt.toISOString());

  const spaceRows: SpacesTableRow[] = spacesRaw.map((s) => {
    const photoCount = photoByEntity.get(s.id) ?? 0;
    const amenityCnt = s._count.amenityPlacements;
    const status =
      amenityCnt === 0
        ? { label: "Sin equipamiento", tone: "warning" as BadgeTone }
        : photoCount === 0
          ? { label: "Sin fotos", tone: "warning" as BadgeTone }
          : { label: "Completo", tone: "success" as BadgeTone };
    return {
      id: s.id,
      name: s.name,
      spaceTypeLabel: getSpaceTypeLabel(s.spaceType, s.spaceType),
      amenityCount: amenityCnt,
      photoCount,
      updatedAtISO: s.updatedAt.toISOString(),
      status,
    };
  });

  const activityItems: ActivityFeedItem[] = auditEntries.map((a) => {
    const { message, tone } = formatActivityMessage(a.entityType, a.action);
    return {
      id: a.id,
      message,
      whenISO: a.createdAt.toISOString(),
      tone,
    };
  });

  return (
    <div>
      <header className="mb-7">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          <span
            className="inline-block h-px w-3 bg-[var(--color-text-subtle)]"
            aria-hidden="true"
          />
          Propiedad · Resumen
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-[var(--color-text-primary)]">
              {property.propertyNickname}
            </h1>
            {location && (
              <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
                {location}
              </p>
            )}
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${STATUS_PILL_BG[statusTone]}`}
          >
            {status === "active" ? (
              <CheckCircle2 size={12} aria-hidden="true" />
            ) : (
              <Clock size={12} aria-hidden="true" />
            )}
            {statusLabel}
          </span>
        </div>

        <div className="mt-3">
          <ChipRow>
            {[
              location && <Chip key="location" icon={MapPin} label={location} />,
              property.maxGuests != null && (
                <Chip
                  key="guests"
                  icon={UsersRound}
                  label="Hasta "
                  emphasis={pluralize(property.maxGuests, "huésped", "huéspedes")}
                />
              ),
              property.bedroomsCount != null && (
                <Chip
                  key="bedrooms"
                  icon={BedDouble}
                  emphasis={pluralize(property.bedroomsCount, "dormitorio", "dormitorios")}
                />
              ),
              property.bathroomsCount != null && (
                <Chip
                  key="bathrooms"
                  icon={Bath}
                  emphasis={pluralize(property.bathroomsCount, "baño", "baños")}
                />
              ),
              property.bedsCount != null && property.bedsCount > 0 && (
                <Chip
                  key="beds"
                  icon={Bed}
                  emphasis={pluralize(property.bedsCount, "cama", "camas")}
                />
              ),
              <Chip key="edited" icon={History} label={`Editada ${lastEditedRel}`} />,
            ].filter(Boolean) as React.ReactElement[]}
          </ChipRow>
        </div>
        <hr className="mt-5 border-[var(--color-border-subtle)]" />
      </header>

      <section className="mb-7">
        <SectionHeading num="01" title="Estado de la guía" />
        <ReadinessHeroCard
          propertyId={propertyId}
          overall={readiness.overall}
          publishable={readiness.publishable}
          usable={readiness.usable}
          scores={readiness.scores}
          blockers={validations.blockers}
          errors={validations.errors}
        />
      </section>

      <section className="mb-7">
        <SectionHeading num="02" title="Actividad" />
        <KpiStrip
          propertyId={propertyId}
          spacesCount={spacesRaw.length}
          amenityCount={amenityCount}
          contactsCount={contactsCount}
          blockersCount={validations.blockers.length + validations.errors.length}
        />
      </section>

      <section className="mb-7">
        <SectionHeading num="03" title="Acciones y eventos" />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <TasksListCard
            propertyId={propertyId}
            scores={readiness.scores}
            blockers={validations.blockers}
            errors={validations.errors}
          />
          <ActivityFeedCard propertyId={propertyId} items={activityItems} />
        </div>
      </section>

      <section className="mb-2">
        <SectionHeading
          num="04"
          title="Espacios"
          action={{
            label: "+ Añadir espacio",
            href: `/properties/${propertyId}/spaces`,
          }}
        />
        <SpacesTableCard
          propertyId={propertyId}
          rows={spaceRows}
          totalCount={spaceRows.length}
        />
      </section>
    </div>
  );
}
