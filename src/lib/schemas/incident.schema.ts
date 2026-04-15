import { z } from "zod";

export const incidentStatuses = ["open", "in_progress", "resolved", "cancelled"] as const;
export const incidentSeverities = ["low", "medium", "high", "critical"] as const;
export const incidentTargetTypes = ["property", "system", "amenity", "space", "access"] as const;

export type IncidentStatus = (typeof incidentStatuses)[number];
export type IncidentSeverity = (typeof incidentSeverities)[number];
export type IncidentTargetType = (typeof incidentTargetTypes)[number];

const dateString = z
  .string()
  .min(1, "La fecha es obligatoria")
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Fecha inválida" });

const optionalDateString = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), { message: "Fecha inválida" });

export const createIncidentSchema = z
  .object({
    title: z.string().min(1, "El título es obligatorio"),
    severity: z.enum(incidentSeverities).optional(),
    status: z.enum(incidentStatuses).optional(),
    targetType: z.enum(incidentTargetTypes),
    targetId: z.string().optional(),
    playbookId: z.string().optional(),
    notes: z.string().optional(),
    visibility: z.string().optional(),
    occurredAt: dateString,
  })
  .refine(
    (data) => data.targetType === "property" || (!!data.targetId && data.targetId.length > 0),
    { message: "Selecciona un objetivo válido", path: ["targetId"] },
  );

export const updateIncidentSchema = z
  .object({
    title: z.string().min(1, "El título es obligatorio"),
    severity: z.enum(incidentSeverities),
    status: z.enum(incidentStatuses),
    targetType: z.enum(incidentTargetTypes),
    targetId: z.string().optional(),
    playbookId: z.string().optional(),
    notes: z.string().optional(),
    visibility: z.string().optional(),
    occurredAt: dateString,
    resolvedAt: optionalDateString,
  })
  .refine(
    (data) => data.targetType === "property" || (!!data.targetId && data.targetId.length > 0),
    { message: "Selecciona un objetivo válido", path: ["targetId"] },
  );

export type CreateIncidentData = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentData = z.infer<typeof updateIncidentSchema>;
