import { notFound } from "next/navigation";
import { Wrench, Tags, CheckCheck, CircleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  troubleshootingTaxonomy,
  findItem,
  findSystemItem,
  findAmenityItem,
  accessMethods,
  getItems,
} from "@/lib/taxonomy-loader";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip, countChipLabel } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { AddPlaybookChips } from "./add-playbook-chips";
import { PlaybooksGrid, type PlaybookCardData } from "./playbooks-grid";
import { computePlaybookStatus } from "./playbook-progress";
import type {
  PlaybookData,
  PlaybookTargetType,
  PlaybookTargetOptions,
  TargetOption,
} from "./playbook-card";

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

  const [playbooks, systems, amenityInstances, spaces, incidentGroups] =
    await Promise.all([
      prisma.troubleshootingPlaybook.findMany({
        where: { propertyId },
        // asc → new playbooks land at the end, next to the "02 Añadir" control.
        orderBy: { createdAt: "asc" },
      }),
      prisma.propertySystem.findMany({
        where: { propertyId },
        select: { systemKey: true },
        distinct: ["systemKey"],
        orderBy: { systemKey: "asc" },
      }),
      prisma.propertyAmenityInstance.findMany({
        where: { propertyId },
        select: { amenityKey: true },
        distinct: ["amenityKey"],
        orderBy: { amenityKey: "asc" },
      }),
      prisma.space.findMany({
        where: { propertyId, status: "active" },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.incident.groupBy({
        by: ["playbookId"],
        where: {
          propertyId,
          status: { in: ["open", "in_progress"] },
          playbookId: { not: null },
        },
        _count: true,
      }),
    ]);

  // ── Shared target options (computed once, used by every card) ──
  const systemOptions: TargetOption[] = systems
    .map((s) => ({ value: s.systemKey, label: findSystemItem(s.systemKey)?.label ?? s.systemKey }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const amenityOptions: TargetOption[] = amenityInstances
    .map((a) => ({ value: a.amenityKey, label: findAmenityItem(a.amenityKey)?.label ?? a.amenityKey }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const spaceOptions: TargetOption[] = spaces.map((s) => ({ value: s.id, label: s.name }));
  const accessOptions: TargetOption[] = getItems(accessMethods).map((a) => ({
    value: a.id,
    label: a.label,
  }));

  // Any target a playbook currently links to but that's no longer configured /
  // active must stay selectable — surface it as an orphan option shared by all
  // cards (so the linked card can render and un-link it).
  const linkedSpaceIds = new Set(
    playbooks.map((p) => p.spaceId).filter((id): id is string => !!id),
  );
  const knownSpaceIds = new Set(spaceOptions.map((o) => o.value));
  const orphanSpaceIds = [...linkedSpaceIds].filter((id) => !knownSpaceIds.has(id));
  const archivedSpaces = orphanSpaceIds.length
    ? await prisma.space.findMany({
        where: { id: { in: orphanSpaceIds }, propertyId },
        select: { id: true, name: true },
      })
    : [];
  for (const s of archivedSpaces) {
    spaceOptions.unshift({ value: s.id, label: `${s.name} (archivado)` });
  }
  for (const p of playbooks) {
    if (p.systemKey && !systemOptions.some((o) => o.value === p.systemKey)) {
      systemOptions.unshift({
        value: p.systemKey,
        label: `${findSystemItem(p.systemKey)?.label ?? p.systemKey} (ya no configurado)`,
      });
    }
    if (p.amenityKey && !amenityOptions.some((o) => o.value === p.amenityKey)) {
      amenityOptions.unshift({
        value: p.amenityKey,
        label: `${findAmenityItem(p.amenityKey)?.label ?? p.amenityKey} (ya no configurado)`,
      });
    }
    if (p.accessMethodKey && !accessOptions.some((o) => o.value === p.accessMethodKey)) {
      accessOptions.unshift({
        value: p.accessMethodKey,
        label: `${findItem(accessMethods, p.accessMethodKey)?.label ?? p.accessMethodKey} (ya no disponible)`,
      });
    }
  }
  const targetOptions: PlaybookTargetOptions = {
    system: systemOptions,
    amenity: amenityOptions,
    space: spaceOptions,
    access: accessOptions,
  };

  const openByPlaybook = new Map<string, number>(
    incidentGroups.flatMap((g) => (g.playbookId ? [[g.playbookId, g._count] as const] : [])),
  );

  function deriveTarget(p: (typeof playbooks)[number]): {
    targetType: PlaybookTargetType;
    targetKey: string;
  } {
    if (p.systemKey) return { targetType: "system", targetKey: p.systemKey };
    if (p.amenityKey) return { targetType: "amenity", targetKey: p.amenityKey };
    if (p.spaceId) return { targetType: "space", targetKey: p.spaceId };
    if (p.accessMethodKey) return { targetType: "access", targetKey: p.accessMethodKey };
    return { targetType: "none", targetKey: "" };
  }

  const cards: PlaybookCardData[] = playbooks.map((p) => {
    const playbook: PlaybookData = {
      id: p.id,
      playbookKey: p.playbookKey,
      title: p.title,
      severity: p.severity,
      symptomsMd: p.symptomsMd ?? "",
      guestStepsMd: p.guestStepsMd ?? "",
      internalStepsMd: p.internalStepsMd ?? "",
      escalationRule: p.escalationRule ?? "",
      visibility: p.visibility,
      ...deriveTarget(p),
    };
    return { playbook, openIncidents: openByPlaybook.get(p.id) ?? 0 };
  });

  // ── Header counts (server-derived from the same pure status fn) ──
  const total = playbooks.length;
  const coveredTypes = new Set(playbooks.map((p) => p.playbookKey)).size;
  const totalTypes = troubleshootingTaxonomy.items.length;
  const readyCount = cards.filter(
    (c) => computePlaybookStatus(c.playbook) === "complete",
  ).length;
  const openLinked = [...openByPlaybook.values()].reduce((a, b) => a + b, 0);

  const addOptions = troubleshootingTaxonomy.items.map((it) => ({
    id: it.id,
    label: it.label,
    recommended: it.recommended ?? false,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Propiedad · Soluciones"
        title="Soluciones"
        description="Guías paso a paso para resolver problemas habituales: se publican en la guía del huésped y alimentan al asistente IA."
        chips={
          <>
            <PageHeaderChip
              icon={Wrench}
              label={countChipLabel(total, "solución", "soluciones")}
            />
            <PageHeaderChip
              icon={Tags}
              label={
                <>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {coveredTypes}
                  </span>{" "}
                  de {totalTypes} tipos cubiertos
                </>
              }
            />
            {total > 0 && (
              <PageHeaderChip
                icon={CheckCheck}
                label={
                  <>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {readyCount}
                    </span>{" "}
                    de {total} listas
                  </>
                }
              />
            )}
            {openLinked > 0 && (
              <PageHeaderChip
                icon={CircleAlert}
                label={
                  <>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {openLinked}
                    </span>{" "}
                    incidencias abiertas
                  </>
                }
              />
            )}
          </>
        }
      />

      <NumberedSection number="01" title="Soluciones">
        {total === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] px-8 py-12 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[var(--color-action-primary-subtle)]">
              <Wrench
                size={20}
                aria-hidden="true"
                className="text-[var(--color-action-primary)]"
              />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Aún no hay soluciones
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--color-text-secondary)]">
              Cada solución documenta cómo resolver un problema habitual. Se
              publica en la guía del huésped y la usa el asistente.
            </p>
          </div>
        ) : (
          <PlaybooksGrid
            propertyId={propertyId}
            cards={cards}
            targetOptions={targetOptions}
          />
        )}
      </NumberedSection>

      <NumberedSection number="02" title="Añadir solución">
        <AddPlaybookChips propertyId={propertyId} options={addOptions} />
      </NumberedSection>
    </>
  );
}
