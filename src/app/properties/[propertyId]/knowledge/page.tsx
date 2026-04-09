import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { CreateKnowledgeItemForm } from "./create-knowledge-form";
import { KnowledgeItemCard } from "./knowledge-item-card";

const VISIBILITY_LABEL: Record<string, { label: string; tone: "neutral" | "success" | "warning" }> = {
  public: { label: "Público", tone: "success" },
  booked_guest: { label: "Huésped confirmado", tone: "neutral" },
  internal: { label: "Interno", tone: "warning" },
};

const JOURNEY_LABEL: Record<string, string> = {
  pre_booking: "Pre-reserva",
  post_booking: "Post-reserva",
  pre_arrival: "Pre-llegada",
  during_stay: "Durante estancia",
  post_stay: "Post-estancia",
};

export default async function KnowledgePage({
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

  const items = await prisma.knowledgeItem.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Base de conocimiento
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Verdad estructurada reutilizable por guías, AI y mensajería.
      </p>

      <div className="mt-8">
        {items.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Sin items de conocimiento
            </h2>
            <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
              Crea el primer item para documentar información reutilizable sobre tu alojamiento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const vis = VISIBILITY_LABEL[item.visibility] ?? VISIBILITY_LABEL.public;
              const journey = item.journeyStage ? JOURNEY_LABEL[item.journeyStage] : null;
              return (
                <KnowledgeItemCard
                  key={item.id}
                  item={{
                    id: item.id,
                    topic: item.topic,
                    bodyMd: item.bodyMd,
                    visibility: item.visibility,
                    journeyStage: item.journeyStage,
                    confidenceScore: item.confidenceScore,
                    lastVerifiedAt: item.lastVerifiedAt?.toISOString() ?? null,
                  }}
                  propertyId={propertyId}
                  visibilityLabel={vis.label}
                  visibilityTone={vis.tone}
                  journeyLabel={journey}
                />
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Añadir item de conocimiento
          </h2>
          <CreateKnowledgeItemForm propertyId={propertyId} />
        </div>
      </div>
    </div>
  );
}
