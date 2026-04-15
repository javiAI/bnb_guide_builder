import { z } from "zod";

// Assistant API audiences exclude "sensitive" on purpose — callers must not
// be able to elevate to sensitive via a request body; that level is reserved
// for server-derived authenticated contexts (not yet wired up).
const ASSISTANT_AUDIENCES = ["guest", "ai", "internal"] as const;

// ── Ask endpoint ──

export const askRequestSchema = z.object({
  question: z.string().min(1, "La pregunta es obligatoria"),
  language: z.string().default("es"),
  audience: z.enum(ASSISTANT_AUDIENCES).default("guest"),
  journeyStage: z.string().optional(),
  conversationId: z.string().optional(),
});

export type AskRequest = z.infer<typeof askRequestSchema>;

export const citationSchema = z.object({
  knowledgeItemId: z.string(),
  sourceId: z.string().nullable(),
  quoteOrNote: z.string().nullable(),
  relevanceScore: z.number().min(0).max(1),
});

export type Citation = z.infer<typeof citationSchema>;

export const askResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema),
  confidenceScore: z.number().min(0).max(1),
  escalated: z.boolean(),
  escalationReason: z.string().nullable(),
  conversationId: z.string(),
});

export type AskResponse = z.infer<typeof askResponseSchema>;

// ── Debug retrieval ──

export const debugRetrieveRequestSchema = z.object({
  question: z.string().min(1, "La pregunta es obligatoria"),
  language: z.string().default("es"),
  audience: z.enum(ASSISTANT_AUDIENCES).default("guest"),
  journeyStage: z.string().optional(),
});

export type DebugRetrieveRequest = z.infer<typeof debugRetrieveRequestSchema>;

export const retrievalCandidateSchema = z.object({
  knowledgeItemId: z.string(),
  topic: z.string(),
  visibility: z.string(),
  confidenceScore: z.number().nullable(),
  relevanceScore: z.number().min(0).max(1),
  journeyStage: z.string().nullable(),
  matchReason: z.string(),
});

export type RetrievalCandidate = z.infer<typeof retrievalCandidateSchema>;

// ── Conversations ──

export const createConversationSchema = z.object({
  actorType: z.enum(["guest", "operator", "system"]),
  audience: z.enum(ASSISTANT_AUDIENCES).default("guest"),
  language: z.string().default("es"),
});

export type CreateConversationRequest = z.infer<typeof createConversationSchema>;
