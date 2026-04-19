import { z } from "zod";
import { entityTypeSchema, journeyStageSchema } from "@/lib/types/knowledge";

// Assistant API audiences exclude "sensitive" on purpose — callers must not
// be able to elevate to sensitive via a request body; that level is reserved
// for server-derived authenticated contexts (not yet wired up).
const ASSISTANT_AUDIENCES = ["guest", "ai", "internal"] as const;

// ── Ask endpoint ──

export const askRequestSchema = z.object({
  question: z.string().min(1, "La pregunta es obligatoria"),
  language: z.string().default("es"),
  audience: z.enum(ASSISTANT_AUDIENCES).default("guest"),
  // Explicit null is accepted alongside undefined so clients can send
  // `{"journeyStage": null}` without a 400 — matches the documented contract
  // in docs/API_ROUTES.md and lets coerceJourneyStage() do the normalization.
  journeyStage: journeyStageSchema.nullable().optional(),
  conversationId: z.string().nullable().optional(),
});

export type AskRequest = z.infer<typeof askRequestSchema>;

export const citationSchema = z.object({
  knowledgeItemId: z.string(),
  sourceType: entityTypeSchema,
  entityLabel: z.string(),
  score: z.number().min(0).max(1),
});

export type Citation = z.infer<typeof citationSchema>;

// ── Escalation handoff (rama 11D) ──

export const escalationChannelSchema = z.object({
  kind: z.enum(["tel", "whatsapp", "email"]),
  rawValue: z.string(),
  href: z.string(),
});

export const escalationContactSchema = z.object({
  id: z.string(),
  roleKey: z.string(),
  displayName: z.string(),
  channels: z.array(escalationChannelSchema),
  emergencyAvailable: z.boolean(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
});

export const escalationResolutionSchema = z.object({
  intentId: z.string().regex(/^int\./),
  intentLabel: z.string(),
  emergencyPriority: z.boolean(),
  fallbackLevel: z.enum(["intent", "intent_with_host", "fallback"]),
  contacts: z.array(escalationContactSchema),
});

export type EscalationResolutionDTO = z.infer<typeof escalationResolutionSchema>;

export const askResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema),
  confidenceScore: z.number().min(0).max(1),
  escalated: z.boolean(),
  escalationReason: z.string().nullable(),
  escalationContact: escalationResolutionSchema.nullable(),
  conversationId: z.string(),
});

export type AskResponse = z.infer<typeof askResponseSchema>;

// ── Debug retrieval ──

export const debugRetrieveRequestSchema = z.object({
  question: z.string().min(1, "La pregunta es obligatoria"),
  language: z.string().default("es"),
  audience: z.enum(ASSISTANT_AUDIENCES).default("guest"),
  journeyStage: journeyStageSchema.nullable().optional(),
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
