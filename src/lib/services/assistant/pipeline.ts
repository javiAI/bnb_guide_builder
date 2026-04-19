// Assistant pipeline orchestrator.
//
// ask(input)  :  intent → retrieve → rerank → synthesize → persist conversation
// retrieve(input) : intent → retrieve → rerank (no synthesize — debug endpoint)
//
// Side effects:
//   • Persists AssistantMessage rows (user turn + assistant turn) when a
//     `conversationId` is provided. If the caller omits it, a new
//     AssistantConversation is created and its id returned.
//
// Invariants:
//   • No `sensitive` content ever leaves the retriever (enforced in
//     `allowedVisibilitiesFor`).
//   • Zero citations → escalate (enforced in the synthesizer).
//   • Reranker scores < 0.3 are dropped before synthesis.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { VisibilityLevel } from "@/lib/visibility";
import type { JourneyStage } from "@/lib/types/knowledge";
import { hybridRetrieve, type RetrievalResult } from "./retriever";
import { resolveReranker, type RerankedItem } from "./reranker";
import {
  resolveSynthesizer,
  type SynthesizerCitation,
  type SynthesizerOutput,
} from "./synthesizer";
import { resolveIntentResolver } from "./intent-resolver";

// ============================================================================
// Tunables
// ============================================================================

const RERANK_TOP_N = 5;
const RERANK_FLOOR = 0.3;
const INTENT_CONFIDENCE_THRESHOLD = 0.7;
const RETRIEVER_TOP_K = 20;

// ============================================================================
// Contract
// ============================================================================

export interface AskInput {
  propertyId: string;
  question: string;
  language: string;
  audience: VisibilityLevel;
  journeyStage?: JourneyStage | null;
  conversationId?: string | null;
  /** ID already inserted in `assistant_messages` for the user turn, or null. */
  actorType?: "guest" | "operator" | "system";
}

export interface AskOutput {
  answer: string;
  citations: SynthesizerCitation[];
  confidenceScore: number;
  escalated: boolean;
  escalationReason: string | null;
  conversationId: string;
  /** Debug metadata kept off the public API schema but useful for ops tests. */
  debug: {
    intent: { journeyStage: JourneyStage; confidence: number; modelId: string };
    retrieval: RetrievalResult["stats"] & { degraded: boolean };
    rerankerModel: string;
    synthesizerModel: string;
  };
}

export interface RetrieveInput {
  propertyId: string;
  question: string;
  language: string;
  audience: VisibilityLevel;
  journeyStage?: JourneyStage | null;
}

export interface RetrieveDebugOutput {
  items: RerankedItem[];
  intent: { journeyStage: JourneyStage; confidence: number; modelId: string };
  retrieval: RetrievalResult["stats"] & { degraded: boolean };
}

// ============================================================================
// Shared intent + retrieval step
// ============================================================================

async function resolveJourneyStage(
  input: { question: string; language: string; journeyStage?: JourneyStage | null },
): Promise<{ journeyStage: JourneyStage; confidence: number; modelId: string; effective: JourneyStage | null }> {
  // Caller override wins — no inference when the caller already knows.
  if (input.journeyStage) {
    return {
      journeyStage: input.journeyStage,
      confidence: 1,
      modelId: "caller-override",
      effective: input.journeyStage,
    };
  }
  const resolver = resolveIntentResolver();
  const res = await resolver.resolve(input.question, input.language);
  return {
    journeyStage: res.journeyStage,
    confidence: res.confidence,
    modelId: res.modelId,
    effective:
      res.confidence >= INTENT_CONFIDENCE_THRESHOLD && res.journeyStage !== "any"
        ? res.journeyStage
        : null,
  };
}

async function retrieveAndRerank(params: {
  propertyId: string;
  question: string;
  language: string;
  audience: VisibilityLevel;
  journeyStage: JourneyStage | null;
}): Promise<{
  retrieval: RetrievalResult;
  reranked: RerankedItem[];
  rerankerModel: string;
}> {
  const retrieval = await hybridRetrieve(
    params.question,
    {
      propertyId: params.propertyId,
      locale: params.language,
      audience: params.audience,
      journeyStage: params.journeyStage,
    },
    { topK: RETRIEVER_TOP_K },
  );

  const reranker = resolveReranker();
  const reranked = await reranker.rerank(
    params.question,
    retrieval.items,
    RERANK_TOP_N,
  );

  const floored = reranked.filter((r) => r.rerankScore >= RERANK_FLOOR);
  return {
    retrieval,
    reranked: floored.length > 0 ? floored : reranked, // keep something if all below floor; synthesizer may still escalate
    rerankerModel: reranker.modelId,
  };
}

// ============================================================================
// Public API
// ============================================================================

export async function retrieve(input: RetrieveInput): Promise<RetrieveDebugOutput> {
  const intent = await resolveJourneyStage(input);
  const { retrieval, reranked } = await retrieveAndRerank({
    propertyId: input.propertyId,
    question: input.question,
    language: input.language,
    audience: input.audience,
    journeyStage: intent.effective,
  });
  return {
    items: reranked,
    intent: {
      journeyStage: intent.journeyStage,
      confidence: intent.confidence,
      modelId: intent.modelId,
    },
    retrieval: { ...retrieval.stats, degraded: retrieval.degraded },
  };
}

export async function ask(input: AskInput): Promise<AskOutput> {
  const intent = await resolveJourneyStage(input);

  const { retrieval, reranked, rerankerModel } = await retrieveAndRerank({
    propertyId: input.propertyId,
    question: input.question,
    language: input.language,
    audience: input.audience,
    journeyStage: intent.effective,
  });

  const synthesizer = resolveSynthesizer();
  let synthesized: SynthesizerOutput;
  if (reranked.length === 0) {
    synthesized = {
      answer: "",
      citations: [],
      escalated: true,
      escalationReason: retrieval.degraded
        ? "knowledge base still indexing"
        : "no retrieval candidates",
      confidenceScore: 0,
    };
  } else {
    synthesized = await synthesizer.synthesize({
      question: input.question,
      language: input.language,
      audience: input.audience,
      items: reranked,
    });
  }

  const conversationId = await persistConversation({
    conversationId: input.conversationId ?? null,
    propertyId: input.propertyId,
    language: input.language,
    audience: input.audience,
    actorType: input.actorType ?? "guest",
    userQuestion: input.question,
    assistantAnswer: synthesized.answer,
    citations: synthesized.citations,
    confidenceScore: synthesized.confidenceScore,
    escalated: synthesized.escalated,
    escalationReason: synthesized.escalationReason,
    reranked,
  });

  return {
    answer: synthesized.answer,
    citations: synthesized.citations,
    confidenceScore: synthesized.confidenceScore,
    escalated: synthesized.escalated,
    escalationReason: synthesized.escalationReason,
    conversationId,
    debug: {
      intent: {
        journeyStage: intent.journeyStage,
        confidence: intent.confidence,
        modelId: intent.modelId,
      },
      retrieval: { ...retrieval.stats, degraded: retrieval.degraded },
      rerankerModel,
      synthesizerModel: synthesizer.modelId,
    },
  };
}

// ============================================================================
// Persistence
// ============================================================================

async function persistConversation(params: {
  conversationId: string | null;
  propertyId: string;
  language: string;
  audience: VisibilityLevel;
  actorType: "guest" | "operator" | "system";
  userQuestion: string;
  assistantAnswer: string;
  citations: SynthesizerCitation[];
  confidenceScore: number;
  escalated: boolean;
  escalationReason: string | null;
  reranked: RerankedItem[];
}): Promise<string> {
  const conversation = params.conversationId
    ? await prisma.assistantConversation.findUnique({
        where: { id: params.conversationId },
        select: { id: true },
      })
    : null;

  const convoId = conversation
    ? conversation.id
    : (await prisma.assistantConversation.create({
        data: {
          propertyId: params.propertyId,
          actorType: params.actorType,
          audience: params.audience,
          language: params.language,
        },
        select: { id: true },
      })).id;

  await prisma.$transaction([
    prisma.assistantMessage.create({
      data: {
        conversationId: convoId,
        role: "user",
        body: params.userQuestion,
      },
    }),
    prisma.assistantMessage.create({
      data: {
        conversationId: convoId,
        role: "assistant",
        body: params.assistantAnswer,
        citationsJson: serializeCitations(params),
        confidenceScore: params.confidenceScore,
        escalated: params.escalated,
      },
    }),
  ]);

  return convoId;
}

/**
 * We don't have a dedicated `escalation_reason` column on AssistantMessage.
 * Keep the reason alongside citations inside the Json envelope — lets us
 * reconstruct history without a migration, and the field name is explicit.
 */
function serializeCitations(
  params: { citations: SynthesizerCitation[]; escalationReason: string | null },
): Prisma.InputJsonValue {
  return {
    citations: params.citations.map((c) => ({ ...c })),
    escalationReason: params.escalationReason,
  } as unknown as Prisma.InputJsonValue;
}

