import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FileText, MessageSquare, Zap } from "lucide-react";

import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { TextLink } from "@/components/ui/text-link";
import { messagingTouchpoints, getItems } from "@/lib/taxonomy-loader";
import { listAvailablePacks } from "@/lib/services/messaging-seed.service";
import { ORIGIN_PACK } from "@/lib/services/messaging-shared";
import { StarterPackPicker } from "@/components/messaging/starter-pack-picker";

const touchpoints = getItems(messagingTouchpoints);

function formatActivity(date: Date): string {
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default async function MessagingPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const [property, templates, automations, pendingDraftsCount] =
    await Promise.all([
      prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
      }),
      prisma.messageTemplate.findMany({
        where: { propertyId },
        select: { touchpointKey: true, status: true, origin: true, updatedAt: true },
      }),
      prisma.messageAutomation.findMany({
        where: { propertyId },
        select: { touchpointKey: true, active: true, updatedAt: true },
      }),
      prisma.messageDraft.count({
        where: { propertyId, status: "pending_review" },
      }),
    ]);

  if (!property) notFound();

  const packs = listAvailablePacks();
  const hasPackRows = templates.some((t) => t.origin === ORIGIN_PACK);
  const touchpointLabels = Object.fromEntries(
    touchpoints.map((tp) => [tp.id, tp.label]),
  );

  const activeAutomationCount = automations.filter((a) => a.active).length;

  const templateCountByTouchpoint = new Map<string, number>();
  const activeAutomationByTouchpoint = new Map<string, number>();
  const lastActivityByTouchpoint = new Map<string, Date>();

  const trackActivity = (key: string, when: Date) => {
    const prev = lastActivityByTouchpoint.get(key);
    if (!prev || when > prev) lastActivityByTouchpoint.set(key, when);
  };

  for (const t of templates) {
    templateCountByTouchpoint.set(
      t.touchpointKey,
      (templateCountByTouchpoint.get(t.touchpointKey) ?? 0) + 1,
    );
    trackActivity(t.touchpointKey, t.updatedAt);
  }

  for (const a of automations) {
    if (a.active) {
      activeAutomationByTouchpoint.set(
        a.touchpointKey,
        (activeAutomationByTouchpoint.get(a.touchpointKey) ?? 0) + 1,
      );
    }
    trackActivity(a.touchpointKey, a.updatedAt);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Mensajería"
        title="Mensajería"
        description="Touchpoints, plantillas y automatizaciones de mensajes para tus huéspedes."
        actions={
          <TextLink
            href={`/properties/${propertyId}/messaging/drafts`}
            size="sm"
            arrow
            aria-label="Ver borradores pendientes"
          >
            {pendingDraftsCount > 0
              ? `${pendingDraftsCount} borrador${pendingDraftsCount !== 1 ? "es" : ""} pendiente${pendingDraftsCount !== 1 ? "s" : ""}`
              : "Borradores"}
          </TextLink>
        }
        chips={
          <>
            <PageHeaderChip
              icon={FileText}
              label="Plantillas"
              value={String(templates.length)}
            />
            <PageHeaderChip
              icon={Zap}
              label="Automatizaciones activas"
              value={String(activeAutomationCount)}
              className="border-[var(--color-action-primary-subtle)] bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary-subtle-fg)]"
            />
          </>
        }
      />

      <StarterPackPicker
        propertyId={propertyId}
        packs={packs}
        hasPackRows={hasPackRows}
        templateCount={templates.length}
        touchpointLabels={touchpointLabels}
      />

      <div className="mt-8 space-y-3">
        {touchpoints.map((tp) => {
          const tplCount = templateCountByTouchpoint.get(tp.id) ?? 0;
          const autoCount = activeAutomationByTouchpoint.get(tp.id) ?? 0;
          const lastActivity = lastActivityByTouchpoint.get(tp.id);

          return (
            <Link
              key={tp.id}
              href={`/properties/${propertyId}/messaging/${tp.id}`}
              className="group flex min-h-[44px] items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4 no-underline transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
            >
              <IconBadge
                icon={MessageSquare}
                tone={autoCount > 0 ? "primary" : "neutral"}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {tp.label}
                </span>
                <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                  {tp.description}
                </p>
                {lastActivity && (
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    Última actividad · {formatActivity(lastActivity)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  label={`${tplCount} plantilla${tplCount !== 1 ? "s" : ""}`}
                  tone={tplCount > 0 ? "success" : "neutral"}
                />
                {autoCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-[var(--badge-radius)] bg-[var(--color-action-primary-subtle)] px-[var(--badge-padding-x)] py-[var(--badge-padding-y)] text-[length:var(--badge-font-size)] font-[number:var(--badge-font-weight)] text-[var(--color-action-primary-subtle-fg)]">
                    <Zap size={11} aria-hidden="true" />
                    {autoCount} auto
                  </span>
                )}
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className="text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
