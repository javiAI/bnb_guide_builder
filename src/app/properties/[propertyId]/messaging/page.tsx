import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { messagingTouchpoints, getItems } from "@/lib/taxonomy-loader";
import {
  listAvailablePacks,
  getMessagingBootstrapStatus,
} from "@/lib/services/messaging-seed.service";
import { StarterPackPicker } from "@/components/messaging/starter-pack-picker";

const touchpoints = getItems(messagingTouchpoints);

export default async function MessagingPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const [property, templates, automations, pendingDraftsCount, bootstrapStatus] =
    await Promise.all([
      prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
      }),
      prisma.messageTemplate.findMany({
        where: { propertyId },
        select: { touchpointKey: true, status: true },
      }),
      prisma.messageAutomation.findMany({
        where: { propertyId },
        select: { touchpointKey: true, active: true },
      }),
      prisma.messageDraft.count({
        where: { propertyId, status: "pending_review" },
      }),
      getMessagingBootstrapStatus(propertyId),
    ]);

  if (!property) notFound();

  const packs = listAvailablePacks();

  const templateCountByTouchpoint = new Map<string, number>();
  const activeAutomationByTouchpoint = new Map<string, number>();

  for (const t of templates) {
    templateCountByTouchpoint.set(
      t.touchpointKey,
      (templateCountByTouchpoint.get(t.touchpointKey) ?? 0) + 1,
    );
  }

  for (const a of automations) {
    if (a.active) {
      activeAutomationByTouchpoint.set(
        a.touchpointKey,
        (activeAutomationByTouchpoint.get(a.touchpointKey) ?? 0) + 1,
      );
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Mensajería
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Touchpoints, plantillas y automatizaciones de mensajes.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Badge label={`${templates.length} plantillas`} tone="neutral" />
        <Badge
          label={`${automations.filter((a) => a.active).length} automations activas`}
          tone={automations.some((a) => a.active) ? "success" : "neutral"}
        />
        <Link
          href={`/properties/${propertyId}/messaging/drafts`}
          className="inline-flex"
          aria-label="Ver drafts pendientes"
        >
          <Badge
            label={`${pendingDraftsCount} drafts pendientes`}
            tone={pendingDraftsCount > 0 ? "warning" : "neutral"}
          />
        </Link>
      </div>

      <StarterPackPicker
        propertyId={propertyId}
        packs={packs}
        hasPackRows={bootstrapStatus.hasPackRows}
        templateCount={templates.length}
      />

      <div className="mt-8 space-y-3">
        {touchpoints.map((tp) => {
          const tplCount = templateCountByTouchpoint.get(tp.id) ?? 0;
          const autoCount = activeAutomationByTouchpoint.get(tp.id) ?? 0;

          return (
            <Link
              key={tp.id}
              href={`/properties/${propertyId}/messaging/${tp.id}`}
              className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 transition-shadow hover:shadow-sm"
            >
              <div>
                <h3 className="text-sm font-medium text-[var(--foreground)]">
                  {tp.label}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
                  {tp.description}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Badge
                  label={`${tplCount} plantilla${tplCount !== 1 ? "s" : ""}`}
                  tone={tplCount > 0 ? "success" : "neutral"}
                />
                {autoCount > 0 && (
                  <Badge label={`${autoCount} auto`} tone="success" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
