import { z } from "zod";

export const CHUNK_TYPES = [
  "fact",
  "procedure",
  "policy",
  "place",
  "troubleshooting",
  "summary",
  "template",
] as const;

export type ChunkType = (typeof CHUNK_TYPES)[number];

export const ENTITY_TYPES = [
  "property",
  "access",
  "policy",
  "contact",
  "amenity",
  "space",
  "system",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const JOURNEY_STAGES = [
  "pre_arrival",
  "arrival",
  "stay",
  "checkout",
  "post_checkout",
  "any",
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export const chunkTypeSchema = z.enum(CHUNK_TYPES);
export const entityTypeSchema = z.enum(ENTITY_TYPES);
export const journeyStageSchema = z.enum(JOURNEY_STAGES);

export interface ExtractedChunk {
  propertyId: string;
  topic: string;
  bodyMd: string;
  locale: string;
  visibility: "guest" | "ai" | "internal";
  confidenceScore: number;
  journeyStage: JourneyStage;
  chunkType: ChunkType;
  entityType: EntityType;
  entityId: string | null;
  canonicalQuestion: string | null;
  contextPrefix: string;
  bm25Text: string;
  tokens: number;
  sourceFields: string[];
  tags: string[];
  contentHash: string;
  templateKey: string;
  validFrom: Date | null;
  validTo: Date | null;
}

export interface KnowledgeTemplateEntry {
  topic: string;
  canonicalQuestion: string;
  bodyTemplate: string;
  journeyStage: JourneyStage;
  sourceFields: string[];
}

export interface KnowledgeTemplates {
  version: string;
  templates: Record<string, Record<string, Record<string, Record<string, KnowledgeTemplateEntry>>>>;
}

export interface ChunkTypeItem {
  id: string;
  label: string;
  description: string;
  targetWordRange: [number, number];
}

export interface ChunkTypesTaxonomy {
  version: string;
  items: ChunkTypeItem[];
}
