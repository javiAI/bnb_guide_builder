import { z } from "zod";
import {
  KNOWN_MESSAGING_VARIABLES,
  KNOWN_MESSAGING_TRIGGERS,
  messagingVariablesByToken,
} from "@/lib/taxonomy-loader";
import {
  extractVariableTokens,
  suggestVariable,
} from "@/lib/services/messaging-variables.service";

// Preserves backwards compatibility for rows written before the taxonomy
// existed. Applied at both schema parse time (inbound writes) and on the
// read path (materializer + UI label) so legacy rows keep working without
// a DB migration.
const LEGACY_TRIGGER_MAP = {
  reservation_relative: "before_arrival",
  on_event: "on_booking_confirmed",
} as const;

export function normaliseTriggerType(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (KNOWN_MESSAGING_TRIGGERS.has(raw)) return raw;
  if (raw in LEGACY_TRIGGER_MAP) {
    return LEGACY_TRIGGER_MAP[raw as keyof typeof LEGACY_TRIGGER_MAP];
  }
  return null;
}

const triggerTypeField = z
  .string()
  .transform((v, ctx) => {
    const normalised = normaliseTriggerType(v);
    if (!normalised) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Trigger desconocido: "${v}"`,
      });
      return z.NEVER;
    }
    return normalised;
  });

// ── Message Templates ──

export const createMessageTemplateSchema = z.object({
  touchpointKey: z.string().min(1, "El touchpoint es obligatorio"),
  channelKey: z.string().optional(),
  subjectLine: z.string().optional(),
  bodyMd: z.string().min(1, "El contenido es obligatorio"),
  language: z.string().default("es"),
});

export const updateMessageTemplateSchema = z.object({
  channelKey: z.string().optional(),
  subjectLine: z.string().optional(),
  bodyMd: z.string().min(1, "El contenido es obligatorio"),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export type CreateMessageTemplateData = z.infer<typeof createMessageTemplateSchema>;
export type UpdateMessageTemplateData = z.infer<typeof updateMessageTemplateSchema>;

// ── Message Automations ──

export const createMessageAutomationSchema = z.object({
  touchpointKey: z.string().min(1, "El touchpoint es obligatorio"),
  templateId: z.string().min(1, "La plantilla es obligatoria"),
  channelKey: z.string().min(1, "El canal es obligatorio"),
  triggerType: triggerTypeField,
  sendOffsetMinutes: z.number().int(),
  active: z.boolean().default(false),
});

export const updateMessageAutomationSchema = z.object({
  channelKey: z.string().optional(),
  triggerType: triggerTypeField.optional(),
  sendOffsetMinutes: z.number().int().optional(),
  active: z.boolean().optional(),
});

export type CreateMessageAutomationData = z.infer<typeof createMessageAutomationSchema>;
export type UpdateMessageAutomationData = z.infer<typeof updateMessageAutomationSchema>;

// ── Variable validation (derived from taxonomies/messaging_variables.json) ──
//
// Source of truth: `taxonomies/messaging_variables.json` → loaded/validated in
// `taxonomy-loader.ts`. Never add a variable here; edit the taxonomy instead.

export interface UnknownVariableReport {
  token: string;
  suggestion: string | null;
}

export interface VariableValidationResult {
  valid: string[];
  unknown: UnknownVariableReport[];
}

/** Static validation of a template body: catches unknown `{{var}}` tokens and
 * proposes the closest known match. Does NOT hit the database — resolution
 * (missing vs resolved vs unresolved_context) lives in
 * `resolveVariables()` from `messaging-variables.service`. */
export function validateVariables(body: string): VariableValidationResult {
  const tokens = extractVariableTokens(body);
  const valid: string[] = [];
  const unknown: UnknownVariableReport[] = [];
  for (const token of tokens) {
    if (KNOWN_MESSAGING_VARIABLES.has(token)) {
      valid.push(token);
    } else {
      unknown.push({ token, suggestion: suggestVariable(token) });
    }
  }
  return { valid, unknown };
}

/** Human-readable Spanish error for an unknown variable, with optional
 * "¿quisiste decir {{y}}?" suggestion. Used by server actions + UI. */
export function describeUnknownVariable(report: UnknownVariableReport): string {
  if (report.suggestion) {
    return `Variable desconocida {{${report.token}}}. ¿Quisiste decir {{${report.suggestion}}}?`;
  }
  return `Variable desconocida {{${report.token}}}.`;
}

/** Convenience helper for templates rendered in non-DB contexts (e.g. tests). */
export function variableLabel(token: string): string | null {
  return messagingVariablesByToken.get(token)?.label ?? null;
}
