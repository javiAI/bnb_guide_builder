// Re-export from the canonical loader so every consumer goes through the
// eager Zod validation in `taxonomy-loader.ts` (variable token regex + send
// policy + preview behaviour enums + group/source coverage). See
// `local-place-categories.ts` for the full rationale.
export {
  messagingVariables,
  messagingVariablesByToken,
  KNOWN_MESSAGING_VARIABLES,
  MV_SEND_POLICIES,
  MV_PREVIEW_BEHAVIORS,
} from "@/lib/taxonomy-loader";
export type {
  MessagingVariableItem,
  MessagingVariableGroup,
  MessagingVariablesFile,
  MessagingVariableSource,
  MessagingVariableSendPolicy,
  MessagingVariablePreviewBehavior,
} from "@/lib/taxonomy-loader";
