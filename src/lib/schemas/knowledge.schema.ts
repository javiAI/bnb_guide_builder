import { z } from "zod";
import { visibilityLevels } from "@/lib/visibility";

// ── Knowledge Items ──

export const createKnowledgeItemSchema = z.object({
  topic: z.string().min(1, "El tema es obligatorio"),
  bodyMd: z.string().min(1, "El contenido es obligatorio"),
  visibility: z.enum(visibilityLevels).optional(),
  journeyStage: z.string().optional(),
});

export const updateKnowledgeItemSchema = z.object({
  topic: z.string().min(1, "El tema es obligatorio"),
  bodyMd: z.string().min(1, "El contenido es obligatorio"),
  visibility: z.enum(visibilityLevels).optional(),
  journeyStage: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
});

export type CreateKnowledgeItemData = z.infer<typeof createKnowledgeItemSchema>;
export type UpdateKnowledgeItemData = z.infer<typeof updateKnowledgeItemSchema>;

// ── Guide Versions ──

export const createGuideVersionSchema = z.object({
  // version number is auto-incremented
});

export const updateGuideSectionSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  sortOrder: z.number().int().optional(),
});

export const createGuideSectionItemSchema = z.object({
  contentMd: z.string().min(1, "El contenido es obligatorio"),
  visibility: z.enum(visibilityLevels).optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateGuideSectionData = z.infer<typeof updateGuideSectionSchema>;
export type CreateGuideSectionItemData = z.infer<typeof createGuideSectionItemSchema>;
