import { z } from "zod";
import messagingTriggersJson from "../../../taxonomies/messaging_triggers.json";

// Self-contained per-domain module: owns its JSON import + Zod schema + boot
// validation. Must NOT import `@/lib/taxonomy-loader` — doing so would drag the
// full loader (every taxonomy JSON) into any client bundle that touches
// messaging triggers. The central loader re-exports from this file instead.

export const MV_TRIGGER_ANCHORS = [
  "checkIn",
  "checkOut",
  "bookingConfirmed",
] as const;
export type MessagingTriggerAnchor = (typeof MV_TRIGGER_ANCHORS)[number];

const MvTriggerPresetSchema = z
  .object({
    label: z.string().min(1),
    offsetMinutes: z.number().int().finite(),
  })
  .strict();

const MvTriggerItemSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1),
    description: z.string().min(1),
    anchorField: z.enum(MV_TRIGGER_ANCHORS),
    requiresReservation: z.boolean(),
    defaultOffsetMinutes: z.number().int().finite(),
    offsetSign: z.enum([
      "negative_typical",
      "positive_typical",
      "bidirectional",
    ]),
    presets: z.array(MvTriggerPresetSchema).min(1),
  })
  .strict();

const MessagingTriggersSchema = z
  .object({
    file: z.literal("messaging_triggers.json"),
    version: z.string().min(1),
    locale: z.string().min(1),
    units_system: z.string().min(1).optional(),
    items: z.array(MvTriggerItemSchema).min(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.items.forEach((item, idx) => {
      if (seen.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", idx, "id"],
          message: `Duplicate trigger id "${item.id}"`,
        });
      }
      seen.add(item.id);
    });
  });

export type MessagingTriggersFile = z.infer<typeof MessagingTriggersSchema>;
export type MessagingTriggerItem = MessagingTriggersFile["items"][number];

function loadMessagingTriggers(): MessagingTriggersFile {
  const parsed = MessagingTriggersSchema.safeParse(messagingTriggersJson);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid taxonomies/messaging_triggers.json:\n${details}`,
    );
  }
  return parsed.data;
}

export const messagingTriggers: MessagingTriggersFile = loadMessagingTriggers();

export const messagingTriggersById: ReadonlyMap<string, MessagingTriggerItem> =
  new Map(messagingTriggers.items.map((t) => [t.id, t]));

export const KNOWN_MESSAGING_TRIGGERS: ReadonlySet<string> = new Set(
  messagingTriggers.items.map((t) => t.id),
);

export function findMessagingTrigger(
  id: string,
): MessagingTriggerItem | undefined {
  return messagingTriggersById.get(id);
}
