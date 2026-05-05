import messagingTriggersJson from "../../../taxonomies/messaging_triggers.json";

export const MV_TRIGGER_ANCHORS = [
  "checkIn",
  "checkOut",
  "bookingConfirmed",
] as const;
export type MessagingTriggerAnchor = (typeof MV_TRIGGER_ANCHORS)[number];

export type MessagingTriggerPreset = {
  label: string;
  offsetMinutes: number;
};

export type MessagingTriggerItem = {
  id: string;
  label: string;
  description: string;
  anchorField: MessagingTriggerAnchor;
  requiresReservation: boolean;
  defaultOffsetMinutes: number;
  offsetSign: "negative_typical" | "positive_typical" | "bidirectional";
  presets: MessagingTriggerPreset[];
};

export type MessagingTriggersFile = {
  file: "messaging_triggers.json";
  version: string;
  locale: string;
  units_system?: string;
  items: MessagingTriggerItem[];
};

export const messagingTriggers =
  messagingTriggersJson as unknown as MessagingTriggersFile;

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
