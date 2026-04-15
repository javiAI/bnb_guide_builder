import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { reviewReasons, getItems } from "@/lib/taxonomy-loader";
import { SECTION_EDITORS } from "@/config/schemas/section-editors";
import type { BadgeTone } from "@/lib/types";

const reasons = getItems(reviewReasons);

const STALE_DAYS = 30;

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      propertyType: true,
      country: true,
      checkInStart: true,
      primaryAccessMethod: true,
    },
  });

  if (!property) notFound();

  // Gather review queue items
  const [
    knowledgeItems,
    spacesCount,
    amenitiesCount,
    mediaCount,
    playbooksCount,
    localPlacesCount,
    templatesCount,
    guideVersions,
  ] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where: { propertyId },
      select: {
        id: true,
        topic: true,
        visibility: true,
        confidenceScore: true,
        lastVerifiedAt: true,
        updatedAt: true,
      },
    }),
    prisma.space.count({ where: { propertyId, status: "active" } }),
    prisma.propertyAmenityInstance.count({ where: { propertyId } }),
    prisma.mediaAsset.count({ where: { propertyId } }),
    prisma.troubleshootingPlaybook.count({ where: { propertyId } }),
    prisma.localPlace.count({ where: { propertyId } }),
    prisma.messageTemplate.count({ where: { propertyId } }),
    prisma.guideVersion.count({ where: { propertyId, status: "published" } }),
  ]);

  // Build review queue
  interface ReviewItem {
    reasonId: string;
    reasonLabel: string;
    entityType: string;
    entityId: string;
    entityLabel: string;
    tone: BadgeTone;
  }

  const reviewQueue: ReviewItem[] = [];
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);

  // Stale content
  for (const ki of knowledgeItems) {
    const lastCheck = ki.lastVerifiedAt ?? ki.updatedAt;
    if (lastCheck < staleCutoff) {
      reviewQueue.push({
        reasonId: "stale_content",
        reasonLabel: "Contenido desactualizado",
        entityType: "KnowledgeItem",
        entityId: ki.id,
        entityLabel: ki.topic,
        tone: "warning",
      });
    }
  }

  // Low confidence
  for (const ki of knowledgeItems) {
    if (ki.confidenceScore != null && ki.confidenceScore < 0.5) {
      reviewQueue.push({
        reasonId: "low_confidence",
        reasonLabel: "Baja confianza",
        entityType: "KnowledgeItem",
        entityId: ki.id,
        entityLabel: ki.topic,
        tone: "danger",
      });
    }
  }

  // Missing media
  if (mediaCount === 0) {
    reviewQueue.push({
      reasonId: "missing_media",
      reasonLabel: "Falta media",
      entityType: "Property",
      entityId: propertyId,
      entityLabel: "Propiedad sin assets de media",
      tone: "warning",
    });
  }

  // Publish blockers
  if (!property.propertyType || !property.country) {
    reviewQueue.push({
      reasonId: "publish_blocker",
      reasonLabel: "Bloqueo de publicación",
      entityType: "Property",
      entityId: propertyId,
      entityLabel: "Faltan datos básicos (tipo, país)",
      tone: "danger",
    });
  }

  if (!property.checkInStart || !property.primaryAccessMethod) {
    reviewQueue.push({
      reasonId: "publish_blocker",
      reasonLabel: "Bloqueo de publicación",
      entityType: "Property",
      entityId: propertyId,
      entityLabel: "Faltan datos de llegada (hora, método acceso)",
      tone: "danger",
    });
  }

  // Visibility mismatches — knowledge items with no visibility set (shouldn't happen but check)
  for (const ki of knowledgeItems) {
    if (ki.visibility === "sensitive") {
      reviewQueue.push({
        reasonId: "visibility_mismatch",
        reasonLabel: "Visibilidad incorrecta",
        entityType: "KnowledgeItem",
        entityId: ki.id,
        entityLabel: `"${ki.topic}" tiene visibilidad 'sensible' (no permitido)`,
        tone: "danger",
      });
    }
  }

  // Content sections completeness
  const contentSections = SECTION_EDITORS.filter((s) => s.group === "content");

  const sectionCounts: Record<string, number> = {
    basics: property.propertyType ? 1 : 0,
    arrival: property.checkInStart ? 1 : 0,
    spaces: spacesCount,
    amenities: amenitiesCount,
    troubleshooting: playbooksCount,
    "local-guide": localPlacesCount,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Analítica
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Gaps, contenido obsoleto y estado de calidad.
      </p>

      {/* Summary stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="Conocimiento" value={knowledgeItems.length} />
        <StatCard label="Espacios" value={spacesCount} />
        <StatCard label="Amenities" value={amenitiesCount} />
        <StatCard label="Media" value={mediaCount} />
        <StatCard label="Playbooks" value={playbooksCount} />
        <StatCard label="Lugares locales" value={localPlacesCount} />
        <StatCard label="Plantillas msg" value={templatesCount} />
        <StatCard label="Guías publicadas" value={guideVersions} />
      </div>

      {/* Section completeness */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Completitud de secciones
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {contentSections.map((section) => {
            const count = sectionCounts[section.key] ?? 0;
            const filled = count > 0;
            return (
              <div
                key={section.key}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
              >
                <span className="text-sm text-[var(--foreground)]">{section.label}</span>
                <Badge
                  label={filled ? "Completado" : "Pendiente"}
                  tone={filled ? "success" : "neutral"}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Review queue */}
      <div className="mt-10">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Cola de revisión ({reviewQueue.length})
        </h2>

        {reviewQueue.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-8 text-center">
            <p className="text-sm text-[var(--color-success-600)]">
              Sin items pendientes de revisión.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {reviewQueue.map((item, i) => (
              <div
                key={`${item.reasonId}-${item.entityId}-${i}`}
                className="flex items-start justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge label={item.reasonLabel} tone={item.tone} />
                    <span className="text-xs text-[var(--color-neutral-400)]">
                      {item.entityType}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--foreground)]">
                    {item.entityLabel}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review reasons legend */}
      <div className="mt-8">
        <h3 className="mb-2 text-xs font-semibold text-[var(--color-neutral-500)]">
          Categorías de revisión
        </h3>
        <div className="flex flex-wrap gap-2">
          {reasons.map((r) => (
            <span
              key={r.id}
              className="rounded-full bg-[var(--color-neutral-100)] px-2.5 py-0.5 text-xs text-[var(--color-neutral-600)]"
            >
              {r.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-center">
      <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-neutral-500)]">{label}</p>
    </div>
  );
}
