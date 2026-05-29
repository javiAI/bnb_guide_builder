import { notFound } from "next/navigation";
import { FileText, Inbox, Zap } from "lucide-react";

import { prisma } from "@/lib/db";
import { messagingTouchpoints, findItem, automationChannels, getItems } from "@/lib/taxonomy-loader";
import { PageHeader } from "@/components/ui/page-header";
import { NumberedSection } from "@/components/ui/numbered-section";
import { TextLink } from "@/components/ui/text-link";
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

  const activeAutomationCount = automations.filter((a) => a.active).length;

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
        eyebrow="Touchpoint"
        title={touchpoint.label}
        description={touchpoint.description}
        chips={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-background-muted)] px-[9px] py-1 text-[12px] text-[var(--color-text-secondary)]">
              <FileText size={12} aria-hidden="true" className="text-[var(--color-text-muted)]" />
              {templates.length} plantilla{templates.length !== 1 ? "s" : ""}
            </span>
            {activeAutomationCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-action-primary-subtle)] px-[9px] py-1 text-[12px] font-medium text-[var(--color-action-primary-subtle-fg)]">
                <Zap size={12} aria-hidden="true" />
                {activeAutomationCount} automatización{activeAutomationCount !== 1 ? "es" : ""} activa{activeAutomationCount !== 1 ? "s" : ""}
              </span>
            )}
          </>
        }
      />

      <NumberedSection number="01" title="Plantillas">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] px-8 py-10 text-center">
            <Inbox size={20} aria-hidden="true" className="text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">
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
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
            Añadir plantilla
          </h3>
          <CreateTemplateForm
            propertyId={propertyId}
            touchpointKey={touchpointKey}
          />
        </div>
      </NumberedSection>

      <NumberedSection number="02" title="Automatizaciones">
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
      </NumberedSection>
    </div>
  );
}
