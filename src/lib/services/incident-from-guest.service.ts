/**
 * Create an `Incident` row from a guest report posted from the public guide
 * (Rama 13D). This is the only sanctioned path into `Incident` with
 * `origin = "guest_guide"`; API routes never touch `prisma.incident.create`
 * directly so the invariants below live in one place.
 *
 * Invariants:
 *   - `categoryKey` must resolve to a known entry in `incident_categories.json`.
 *   - `title` is derived server-side (`[CATEGORY_LABEL] — short summary`) —
 *     never accepts client-provided title to keep host-facing copy stable.
 *   - `severity` seeds from the taxonomy's `defaultSeverity` (host can escalate
 *     later). Never trusted from the client.
 *   - `visibility` is always `internal` — the guest never sees their own
 *     report through the normal visibility pipeline. Guest reads go through
 *     the cookie-authorized route which projects only the whitelisted fields.
 *   - `targetType` uses the category's default unless the client provides a
 *     valid concrete target (`{spaceId|amenityId|systemId}` mapped + existing
 *     on the property).
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  findIncidentCategory,
  isIncidentCategoryKey,
  isHostRole,
} from "@/lib/taxonomy-loader";
import {
  notifyHostOfIncident,
  type NotificationResult,
} from "./incident-notification.service";

const SUMMARY_MAX = 500;
const TITLE_MAX = 180;
const CONTACT_MAX = 200;

// The optional contact is a free-form opt-in handle (email / phone / whatsapp
// number). We intentionally don't regex-validate — guests might pass a local
// format we don't know about, and the field is only for the host's use.
export const GuestIncidentPayloadSchema = z
  .object({
    categoryKey: z.string().refine(isIncidentCategoryKey, {
      message: "categoryKey must be a registered ic.* key",
    }),
    summary: z
      .string()
      .trim()
      .min(1, { message: "summary is required" })
      .max(SUMMARY_MAX, {
        message: `summary must be at most ${SUMMARY_MAX} characters`,
      }),
    guestContactOptional: z
      .string()
      .trim()
      .max(CONTACT_MAX)
      .optional(),
    attachedItem: z
      .object({
        kind: z.enum(["space", "amenity", "system", "access"]),
        id: z.string().min(1),
      })
      .optional(),
  })
  .strict();

export type GuestIncidentPayload = z.infer<typeof GuestIncidentPayloadSchema>;

export interface CreateGuestIncidentInput {
  propertyId: string;
  payload: GuestIncidentPayload;
}

export interface CreateGuestIncidentResult {
  incidentId: string;
  notification: NotificationResult;
}

function truncateSummary(summary: string, max: number): string {
  if (summary.length <= max) return summary;
  return `${summary.slice(0, max - 1).trimEnd()}…`;
}

async function resolveTargetFromAttachment(
  propertyId: string,
  attached: GuestIncidentPayload["attachedItem"],
): Promise<{ targetType: string; targetId: string | null } | null> {
  if (!attached) return null;
  switch (attached.kind) {
    case "space": {
      const row = await prisma.space.findFirst({
        where: { id: attached.id, propertyId },
        select: { id: true },
      });
      return row ? { targetType: "space", targetId: row.id } : null;
    }
    case "amenity": {
      const row = await prisma.propertyAmenityInstance.findFirst({
        where: { id: attached.id, propertyId },
        select: { id: true },
      });
      return row ? { targetType: "amenity", targetId: row.id } : null;
    }
    case "system": {
      const row = await prisma.propertySystem.findFirst({
        where: { id: attached.id, propertyId },
        select: { id: true },
      });
      return row ? { targetType: "system", targetId: row.id } : null;
    }
    case "access": {
      // Access methods are property-scoped but currently do not have a
      // dedicated instance model. The category default handles them via
      // `targetType: "access"` with `targetId: null`.
      return { targetType: "access", targetId: null };
    }
    default:
      return null;
  }
}

async function resolveHostEmail(propertyId: string): Promise<string | null> {
  const candidates = await prisma.contact.findMany({
    where: { propertyId, email: { not: null } },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: { email: true, roleKey: true, isPrimary: true },
  });
  const host = candidates.find((c) => isHostRole(c.roleKey));
  const chosen = host ?? candidates[0];
  return chosen?.email ?? null;
}

export async function createIncidentFromGuest(
  input: CreateGuestIncidentInput,
  now: Date = new Date(),
): Promise<CreateGuestIncidentResult> {
  const { propertyId, payload } = input;
  const category = findIncidentCategory(payload.categoryKey);
  if (!category) {
    // Schema refinement already guards this; the throw protects against a
    // hypothetical drift where taxonomy changes between parse and create.
    throw new Error(`Unknown categoryKey: ${payload.categoryKey}`);
  }

  const resolvedTarget = await resolveTargetFromAttachment(
    propertyId,
    payload.attachedItem,
  );
  const targetType = resolvedTarget?.targetType ?? category.defaultTargetType;
  const targetId = resolvedTarget?.targetId ?? null;

  const titleBase = `[${category.label}] ${payload.summary.slice(0, 80)}`;
  const title =
    titleBase.length <= TITLE_MAX
      ? titleBase
      : `${titleBase.slice(0, TITLE_MAX - 1).trimEnd()}…`;

  const incident = await prisma.incident.create({
    data: {
      propertyId,
      title,
      severity: category.defaultSeverity,
      status: "open",
      targetType,
      targetId,
      notes: truncateSummary(payload.summary, SUMMARY_MAX),
      origin: "guest_guide",
      reporterType: "guest",
      categoryKey: category.id,
      // Empty/whitespace-only contact normalizes to null so the host panel
      // doesn't render a blank field as if the guest had opted in.
      guestContactOptional:
        payload.guestContactOptional && payload.guestContactOptional.length > 0
          ? payload.guestContactOptional
          : null,
      visibility: "internal",
      occurredAt: now,
    },
    select: { id: true },
  });

  const [property, hostEmail] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: { propertyNickname: true },
    }),
    resolveHostEmail(propertyId),
  ]);

  const hostPanelUrl = `/properties/${propertyId}/incidents/${incident.id}`;

  const notification = await notifyHostOfIncident({
    incidentId: incident.id,
    propertyId,
    propertyName: property?.propertyNickname ?? "(sin nombre)",
    categoryLabel: category.label,
    severity: category.defaultSeverity,
    summary: truncateSummary(payload.summary, 240),
    reportedAt: now,
    hostPanelUrl,
    recipientEmail: hostEmail ?? "",
  });

  return { incidentId: incident.id, notification };
}
