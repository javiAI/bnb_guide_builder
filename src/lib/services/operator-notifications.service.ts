import { prisma } from "@/lib/db";
import { runAllValidations } from "@/lib/validations/run-all";

/**
 * Operator notification feed (Liora 16F.5). v1 aggregates the two highest-signal
 * sources for "what needs my attention now":
 *   - publish blockers (cross-validations of severity "blocker")
 *   - open incidents (status open | in_progress)
 *
 * Read-only and derived from existing data — no new model, no mutation. Drafts /
 * stale-knowledge sources are a documented follow-up (see docs/FUTURE.md).
 */
export type OperatorNotificationKind = "blocker" | "incident";

export interface OperatorNotification {
  id: string;
  kind: OperatorNotificationKind;
  title: string;
  href: string;
}

export async function getOperatorNotifications(
  propertyId: string,
): Promise<OperatorNotification[]> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { maxGuests: true, infantsAllowed: true, accessMethodsJson: true },
  });
  if (!property) return [];

  const [validations, openIncidents] = await Promise.all([
    runAllValidations(propertyId, {
      maxGuests: property.maxGuests,
      infantsAllowed: property.infantsAllowed,
      accessMethodsJson: property.accessMethodsJson,
    }),
    prisma.incident.findMany({
      where: { propertyId, status: { in: ["open", "in_progress"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true },
    }),
  ]);

  const notifications: OperatorNotification[] = [];

  for (const blocker of validations.blockers) {
    notifications.push({
      id: `blocker:${blocker.id}`,
      kind: "blocker",
      title: blocker.message,
      href: blocker.ctaUrl ?? `/properties/${propertyId}/publishing`,
    });
  }

  for (const incident of openIncidents) {
    notifications.push({
      id: `incident:${incident.id}`,
      kind: "incident",
      title: incident.title,
      href: `/properties/${propertyId}/incidents/${incident.id}`,
    });
  }

  return notifications;
}
