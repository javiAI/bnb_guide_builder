// Re-export from the canonical loader so every consumer goes through the
// eager Zod validation in `taxonomy-loader.ts` (trigger id regex + anchor
// enum + offset signs + duplicate-id rejection). See
// `local-place-categories.ts` for the full rationale.
export {
  messagingTriggers,
  messagingTriggersById,
  KNOWN_MESSAGING_TRIGGERS,
  MV_TRIGGER_ANCHORS,
  findMessagingTrigger,
} from "@/lib/taxonomy-loader";
export type {
  MessagingTriggerItem,
  MessagingTriggersFile,
  MessagingTriggerAnchor,
} from "@/lib/taxonomy-loader";
