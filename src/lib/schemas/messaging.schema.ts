import { z } from "zod";

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
  triggerType: z.enum(["reservation_relative", "on_event"]),
  sendOffsetMinutes: z.number().int(),
  active: z.boolean().default(false),
});

export const updateMessageAutomationSchema = z.object({
  channelKey: z.string().optional(),
  triggerType: z.enum(["reservation_relative", "on_event"]).optional(),
  sendOffsetMinutes: z.number().int().optional(),
  active: z.boolean().optional(),
});

export type CreateMessageAutomationData = z.infer<typeof createMessageAutomationSchema>;
export type UpdateMessageAutomationData = z.infer<typeof updateMessageAutomationSchema>;

// ── Variable validation ──

const TEMPLATE_VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

export const KNOWN_VARIABLES: Record<string, string> = {
  guest_name: "Nombre del huésped",
  property_name: "Nombre del alojamiento",
  check_in_date: "Fecha de check-in",
  check_in_time: "Hora de check-in",
  check_out_date: "Fecha de check-out",
  check_out_time: "Hora de check-out",
  access_instructions: "Instrucciones de acceso",
  wifi_name: "Nombre WiFi",
  wifi_password: "Contraseña WiFi",
  host_name: "Nombre del anfitrión",
  support_contact: "Contacto de soporte",
  guide_url: "URL de la guía",
};

export function extractVariables(body: string): string[] {
  const matches = body.matchAll(TEMPLATE_VARIABLE_REGEX);
  return [...new Set([...matches].map((m) => m[1]))];
}

export function validateVariables(body: string): {
  valid: string[];
  unknown: string[];
} {
  const vars = extractVariables(body);
  const valid = vars.filter((v) => v in KNOWN_VARIABLES);
  const unknown = vars.filter((v) => !(v in KNOWN_VARIABLES));
  return { valid, unknown };
}
