import { z } from "zod";

// ── Checklist ──

export const createChecklistItemSchema = z.object({
  scopeKey: z.string().min(1, "El alcance es obligatorio"),
  title: z.string().min(1, "El título es obligatorio"),
  detailsMd: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  required: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const updateChecklistItemSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  detailsMd: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ── Stock ──

export const createStockItemSchema = z.object({
  categoryKey: z.string().min(1, "La categoría es obligatoria"),
  name: z.string().min(1, "El nombre es obligatorio"),
  restockThreshold: z.number().int().positive().optional(),
  locationNote: z.string().optional(),
  unitLabel: z.string().optional(),
});

export const updateStockItemSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  restockThreshold: z.number().int().positive().optional(),
  locationNote: z.string().optional(),
  unitLabel: z.string().optional(),
});

// ── Maintenance ──

export const createMaintenanceTaskSchema = z.object({
  taskType: z.string().min(1, "El tipo es obligatorio"),
  title: z.string().min(1, "El título es obligatorio"),
  cadenceKey: z.string().optional(),
  nextDueAt: z.string().optional(), // ISO date string
  ownerNote: z.string().optional(),
});

export const updateMaintenanceTaskSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  cadenceKey: z.string().optional(),
  nextDueAt: z.string().optional(),
  ownerNote: z.string().optional(),
});

export type CreateChecklistItemData = z.infer<typeof createChecklistItemSchema>;
export type CreateStockItemData = z.infer<typeof createStockItemSchema>;
export type CreateMaintenanceTaskData = z.infer<typeof createMaintenanceTaskSchema>;
