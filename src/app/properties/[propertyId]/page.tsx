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
  Plus,
} from "lucide-react";
import { prisma } from "@/lib/db";
import {
  STATUS_LABELS,
  STATUS_TONES,
  type PropertyStatus,
  type BadgeTone,
} from "@/lib/types";
import { getDerived } from "@/lib/services/property-derived.service";
import { getValidationsForProperty } from "@/lib/validations/run-all";
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
import { ModuleContainer } from "@/components/layout/module-container";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { TextLink } from "@/components/ui/text-link";

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
      updatedAt: true,
    },
  });

  if (!property) notFound();

  const [derived, validations, spacesRaw, amenityCount, contactsCount, auditEntries] =
    await Promise.all([
      getDerived(propertyId),
      getValidationsForProperty(propertyId),
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

  const statusPill = (
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
  );

  return (
    <ModuleContainer
      eyebrow="Propiedad · Resumen"
      title={property.propertyNickname}
      description={location || undefined}
      actions={statusPill}
      chips={
        <ChipRow>
          {[
            location && <PageHeaderChip key="location" icon={MapPin} label={location} />,
            property.maxGuests != null && (
              <PageHeaderChip
                key="guests"
                icon={UsersRound}
                label="Hasta"
                value={pluralize(property.maxGuests, "huésped", "huéspedes")}
              />
            ),
            property.bedroomsCount != null && (
              <PageHeaderChip
                key="bedrooms"
                icon={BedDouble}
                value={pluralize(property.bedroomsCount, "dormitorio", "dormitorios")}
              />
            ),
            property.bathroomsCount != null && (
              <PageHeaderChip
                key="bathrooms"
                icon={Bath}
                value={pluralize(property.bathroomsCount, "baño", "baños")}
              />
            ),
            property.bedsCount != null && property.bedsCount > 0 && (
              <PageHeaderChip
                key="beds"
                icon={Bed}
                value={pluralize(property.bedsCount, "cama", "camas")}
              />
            ),
            <PageHeaderChip key="edited" icon={History} label={`Editada ${lastEditedRel}`} />,
          ].filter(Boolean) as React.ReactElement[]}
        </ChipRow>
      }
    >
      <NumberedSection number="01" title="Estado de la guía">
        <ReadinessHeroCard
          propertyId={propertyId}
          overall={readiness.overall}
          publishable={readiness.publishable}
          usable={readiness.usable}
          scores={readiness.scores}
          blockers={validations.blockers}
          errors={validations.errors}
        />
      </NumberedSection>

      <NumberedSection
        number="02"
        title="Actividad"
        action={
          <TextLink
            href={`/properties/${propertyId}/analytics`}
            size="sm"
            arrow
          >
            Ver analítica
          </TextLink>
        }
      >
        <KpiStrip
          propertyId={propertyId}
          spacesCount={spacesRaw.length}
          amenityCount={amenityCount}
          contactsCount={contactsCount}
          blockersCount={validations.blockers.length + validations.errors.length}
        />
      </NumberedSection>

      {/* Two-up — left unnumbered (supporting row, mirrors the kit): each card
          self-describes via its own SectionEyebrow header. */}
      <section className="mb-8">
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

      <NumberedSection
        number="03"
        title="Espacios"
        action={
          <TextLink
            href={`/properties/${propertyId}/spaces`}
            size="sm"
            className="inline-flex items-center gap-1"
          >
            <Plus size={12} aria-hidden="true" />
            Añadir espacio
          </TextLink>
        }
      >
        <SpacesTableCard
          propertyId={propertyId}
          rows={spaceRows}
          totalCount={spaceRows.length}
        />
      </NumberedSection>
    </ModuleContainer>
  );
}
