import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { messagingTouchpoints, findItem, automationChannels, getItems } from "@/lib/taxonomy-loader";
import { CreateTemplateForm } from "./create-template-form";
import { TemplateCard } from "./template-card";
import { AutomationSection } from "./automation-section";

const channels = getItems(automationChannels);

const STATUS_BADGE: Record<string, { label: string; tone: "neutral" | "success" | "warning" }> = {
  draft: { label: "Borrador", tone: "neutral" },
  active: { label: "Activa", tone: "success" },
  archived: { label: "Archivada", tone: "warning" },
};

export default async function TouchpointDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string; touchpointKey: string }>;
}) {
  const { propertyId, touchpointKey } = await params;

  const touchpoint = findItem(messagingTouchpoints, touchpointKey);
  if (!touchpoint) notFound();

  const [property, templates, automations] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    }),
    prisma.messageTemplate.findMany({
      where: { propertyId, touchpointKey },
      orderBy: { createdAt: "desc" },
    }),
    prisma.messageAutomation.findMany({
      where: { propertyId, touchpointKey },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!property) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        {touchpoint.label}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        {touchpoint.description}
      </p>

      {/* Templates */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Plantillas
        </h2>

        {templates.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-8 text-center">
            <p className="text-sm text-[var(--color-neutral-500)]">
              Sin plantillas para este touchpoint.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((tpl) => {
              const status = STATUS_BADGE[tpl.status] ?? STATUS_BADGE.draft;
              const channelLabel = channels.find((c) => c.id === tpl.channelKey)?.label;
              return (
                <TemplateCard
                  key={tpl.id}
                  template={{
                    id: tpl.id,
                    bodyMd: tpl.bodyMd,
                    channelKey: tpl.channelKey,
                    subjectLine: tpl.subjectLine,
                    status: tpl.status,
                    language: tpl.language,
                  }}
                  propertyId={propertyId}
                  statusLabel={status.label}
                  statusTone={status.tone}
                  channelLabel={channelLabel ?? null}
                />
              );
            })}
          </div>
        )}

        <div className="mt-6">
          <h3 className="mb-3 text-xs font-semibold text-[var(--color-neutral-500)]">
            Añadir plantilla
          </h3>
          <CreateTemplateForm
            propertyId={propertyId}
            touchpointKey={touchpointKey}
          />
        </div>
      </div>

      {/* Automations */}
      <div className="mt-10">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Automatizaciones
        </h2>
        <AutomationSection
          automations={automations.map((a) => ({
            id: a.id,
            templateId: a.templateId,
            channelKey: a.channelKey,
            triggerType: a.triggerType,
            sendOffsetMinutes: a.sendOffsetMinutes,
            active: a.active,
          }))}
          templates={templates.map((t) => ({ id: t.id, subjectLine: t.subjectLine, bodyMd: t.bodyMd }))}
          propertyId={propertyId}
          touchpointKey={touchpointKey}
        />
      </div>
    </div>
  );
}
