import { z } from "zod";
import messagingVariablesJson from "../../../taxonomies/messaging_variables.json";

// Self-contained per-domain module: owns its JSON import + Zod schema + boot
// validation. Must NOT import `@/lib/taxonomy-loader` — doing so would drag the
// full loader (every taxonomy JSON) into any client bundle that touches
// messaging variables. The central loader re-exports from this file instead.

export const MV_SEND_POLICIES = [
  "safe_always",
  "sensitive_prearrival",
  "internal_only",
] as const;
export type MessagingVariableSendPolicy = (typeof MV_SEND_POLICIES)[number];

export const MV_PREVIEW_BEHAVIORS = ["resolve", "placeholder"] as const;
export type MessagingVariablePreviewBehavior =
  (typeof MV_PREVIEW_BEHAVIORS)[number];

export const MV_SOURCE_KINDS = [
  "property_field",
  "contact",
  "knowledge_item",
  "derived",
  "reservation",
] as const;
export type MessagingVariableSourceKind = (typeof MV_SOURCE_KINDS)[number];

const MvPropertyFieldSourceSchema = z
  .object({
    kind: z.literal("property_field"),
    path: z.string().min(1),
  })
  .strict();

const MvContactSourceSchema = z
  .object({
    kind: z.literal("contact"),
    roleKey: z.string().min(1),
    fallbackRoleKeys: z.array(z.string().min(1)).optional(),
    field: z.enum(["displayName", "phone", "whatsapp", "email"]),
  })
  .strict();

const MvKnowledgeItemSourceSchema = z
  .object({
    kind: z.literal("knowledge_item"),
    topic: z.string().min(1),
  })
  .strict();

const MvDerivedSourceSchema = z
  .object({
    kind: z.literal("derived"),
    derivation: z.string().min(1),
  })
  .strict();

const MvReservationSourceSchema = z
  .object({
    kind: z.literal("reservation"),
    field: z.string().min(1),
  })
  .strict();

const MvSourceSchema = z.discriminatedUnion("kind", [
  MvPropertyFieldSourceSchema,
  MvContactSourceSchema,
  MvKnowledgeItemSourceSchema,
  MvDerivedSourceSchema,
  MvReservationSourceSchema,
]);

const VARIABLE_TOKEN = /^[a-z][a-z0-9_]*$/;

const MvItemSchema = z
  .object({
    id: z.string().regex(/^mv\.[a-z][a-z0-9_]*$/, "id must match mv.<token>"),
    variable: z
      .string()
      .regex(VARIABLE_TOKEN, "variable must be snake_case"),
    label: z.string().min(1),
    description: z.string().min(1),
    group: z.string().min(1),
    source: MvSourceSchema,
    sendPolicy: z.enum(MV_SEND_POLICIES),
    previewBehavior: z.enum(MV_PREVIEW_BEHAVIORS),
    example: z.string().min(1),
  })
  .strict();

const MvGroupSchema = z
  .object({ id: z.string().min(1), label: z.string().min(1) })
  .strict();

const MessagingVariablesSchema = z
  .object({
    file: z.literal("messaging_variables.json"),
    version: z.string().min(1),
    locale: z.string().min(1),
    units_system: z.string().min(1).optional(),
    groups: z.array(MvGroupSchema).min(1),
    items: z.array(MvItemSchema).min(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    const groupIds = new Set(data.groups.map((g) => g.id));
    const seenVariables = new Set<string>();
    const seenIds = new Set<string>();
    data.items.forEach((item, idx) => {
      if (!groupIds.has(item.group)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", idx, "group"],
          message: `Unknown group "${item.group}"`,
        });
      }
      if (seenIds.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", idx, "id"],
          message: `Duplicate id "${item.id}"`,
        });
      }
      seenIds.add(item.id);
      if (seenVariables.has(item.variable)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", idx, "variable"],
          message: `Duplicate variable "${item.variable}"`,
        });
      }
      seenVariables.add(item.variable);
      if (
        item.source.kind === "reservation" &&
        item.previewBehavior !== "placeholder"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", idx, "previewBehavior"],
          message:
            "reservation vars must declare previewBehavior=placeholder (12A)",
        });
      }
    });
  });

export type MessagingVariablesFile = z.infer<typeof MessagingVariablesSchema>;
export type MessagingVariableItem = MessagingVariablesFile["items"][number];
export type MessagingVariableGroup = MessagingVariablesFile["groups"][number];
export type MessagingVariableSource = MessagingVariableItem["source"];

function loadMessagingVariables(): MessagingVariablesFile {
  const parsed = MessagingVariablesSchema.safeParse(messagingVariablesJson);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid taxonomies/messaging_variables.json:\n${details}`,
    );
  }
  return parsed.data;
}

export const messagingVariables: MessagingVariablesFile =
  loadMessagingVariables();

/** Map `variable` → item for O(1) lookup in the resolver. */
export const messagingVariablesByToken: ReadonlyMap<
  string,
  MessagingVariableItem
> = new Map(messagingVariables.items.map((i) => [i.variable, i]));

/** Known variable tokens (the set of legal `{{var}}` names). */
export const KNOWN_MESSAGING_VARIABLES: ReadonlySet<string> = new Set(
  messagingVariables.items.map((i) => i.variable),
);
