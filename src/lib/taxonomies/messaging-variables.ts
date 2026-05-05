import messagingVariablesJson from "../../../taxonomies/messaging_variables.json";

export const MV_SEND_POLICIES = [
  "safe_always",
  "sensitive_prearrival",
  "internal_only",
] as const;
export type MessagingVariableSendPolicy = (typeof MV_SEND_POLICIES)[number];

export const MV_PREVIEW_BEHAVIORS = ["resolve", "placeholder"] as const;
export type MessagingVariablePreviewBehavior =
  (typeof MV_PREVIEW_BEHAVIORS)[number];

export type MessagingVariableSource =
  | { kind: "property_field"; path: string }
  | {
      kind: "contact";
      roleKey: string;
      fallbackRoleKeys?: string[];
      field: "displayName" | "phone" | "whatsapp" | "email";
    }
  | { kind: "knowledge_item"; topic: string }
  | { kind: "derived"; derivation: string }
  | { kind: "reservation"; field: string };

export type MessagingVariableItem = {
  id: string;
  variable: string;
  label: string;
  description: string;
  group: string;
  source: MessagingVariableSource;
  sendPolicy: MessagingVariableSendPolicy;
  previewBehavior: MessagingVariablePreviewBehavior;
  example: string;
};

export type MessagingVariableGroup = { id: string; label: string };

export type MessagingVariablesFile = {
  file: "messaging_variables.json";
  version: string;
  locale: string;
  units_system?: string;
  groups: MessagingVariableGroup[];
  items: MessagingVariableItem[];
};

export const messagingVariables =
  messagingVariablesJson as unknown as MessagingVariablesFile;

export const messagingVariablesByToken: ReadonlyMap<
  string,
  MessagingVariableItem
> = new Map(messagingVariables.items.map((i) => [i.variable, i]));

export const KNOWN_MESSAGING_VARIABLES: ReadonlySet<string> = new Set(
  messagingVariables.items.map((i) => i.variable),
);
