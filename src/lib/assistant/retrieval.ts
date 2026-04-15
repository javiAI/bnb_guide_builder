import { prisma } from "@/lib/db";
import type { RetrievalCandidate } from "@/lib/schemas/assistant.schema";
import { type VisibilityLevel, VISIBILITY_ORDER } from "@/lib/visibility";

type AssistantAudience = Exclude<VisibilityLevel, "sensitive">;

/**
 * Visibility hierarchy: guest < ai < internal.
 * An audience sees everything at its own level or below.
 * The "sensitive" level is NEVER surfaced through the assistant retrieval
 * path — callers cannot elevate to it via the public API; it is reserved
 * for out-of-band authenticated flows.
 */
function allowedVisibilitiesFor(audience: AssistantAudience): VisibilityLevel[] {
  const audienceOrder = VISIBILITY_ORDER[audience];
  return (Object.keys(VISIBILITY_ORDER) as VisibilityLevel[]).filter(
    (v) => VISIBILITY_ORDER[v] <= audienceOrder && v !== "sensitive",
  );
}

export interface RetrievalOptions {
  propertyId: string;
  question: string;
  language: string;
  audience: AssistantAudience;
  journeyStage?: string;
}

/**
 * Retrieve knowledge item candidates for a given question.
 *
 * Pipeline:
 * 1. Filter by property, language, visibility
 * 2. Optional journey stage filter
 * 3. Keyword matching (simple word overlap for MVP)
 * 4. Rank by relevance score
 * 5. Strict exclusion of sensitive visibility
 */
export async function retrieveCandidates(
  opts: RetrievalOptions,
): Promise<RetrievalCandidate[]> {
  const allowedVisibilities = allowedVisibilitiesFor(opts.audience);

  // Step 1-2: DB query with visibility and language filters
  const where: Record<string, unknown> = {
    propertyId: opts.propertyId,
    language: opts.language,
    visibility: { in: allowedVisibilities },
  };

  if (opts.journeyStage) {
    where.journeyStage = opts.journeyStage;
  }

  const items = await prisma.knowledgeItem.findMany({
    where,
    include: {
      citations: {
        include: { source: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Step 3: Keyword matching — simple word overlap
  const queryWords = normalizeAndTokenize(opts.question);

  const candidates: RetrievalCandidate[] = items.map((item) => {
    const topicWords = normalizeAndTokenize(item.topic);
    const bodyWords = normalizeAndTokenize(item.bodyMd);

    // Calculate relevance: topic matches weighted 2x, body 1x
    let matchCount = 0;
    const totalQueryWords = queryWords.length || 1;

    for (const qw of queryWords) {
      if (topicWords.some((tw) => tw.includes(qw) || qw.includes(tw))) {
        matchCount += 2;
      }
      if (bodyWords.some((bw) => bw.includes(qw) || qw.includes(bw))) {
        matchCount += 1;
      }
    }

    const relevanceScore = Math.min(matchCount / (totalQueryWords * 3), 1);

    const matchReasons: string[] = [];
    if (matchCount > 0) matchReasons.push("keyword_match");
    if (opts.journeyStage && item.journeyStage === opts.journeyStage) {
      matchReasons.push("journey_match");
    }

    return {
      knowledgeItemId: item.id,
      topic: item.topic,
      visibility: item.visibility,
      confidenceScore: item.confidenceScore,
      relevanceScore,
      journeyStage: item.journeyStage,
      matchReason: matchReasons.join(", ") || "candidate",
    };
  });

  // Step 4: Rank by relevance descending
  candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return candidates;
}

/**
 * Build answer from top candidates.
 *
 * Confidence gating: if best candidate relevance < threshold, escalate.
 */
export interface AnswerResult {
  answer: string;
  citations: Array<{
    knowledgeItemId: string;
    sourceId: string | null;
    quoteOrNote: string | null;
    relevanceScore: number;
  }>;
  confidenceScore: number;
  escalated: boolean;
  escalationReason: string | null;
}

const CONFIDENCE_THRESHOLD = 0.3;
const MAX_CANDIDATES = 5;

export async function buildAnswer(
  opts: RetrievalOptions,
): Promise<AnswerResult> {
  const candidates = await retrieveCandidates(opts);
  const topCandidates = candidates.slice(0, MAX_CANDIDATES);

  // Confidence gating
  const bestScore = topCandidates[0]?.relevanceScore ?? 0;

  if (topCandidates.length === 0 || bestScore < CONFIDENCE_THRESHOLD) {
    return {
      answer:
        "No tengo suficiente información para responder con confianza. Te recomiendo contactar al anfitrión directamente.",
      citations: [],
      confidenceScore: bestScore,
      escalated: true,
      escalationReason:
        topCandidates.length === 0
          ? "no_candidates"
          : "low_confidence",
    };
  }

  // Build answer from relevant items
  const allowedVisibilities = allowedVisibilitiesFor(opts.audience);

  const relevantItems = await prisma.knowledgeItem.findMany({
    where: {
      id: { in: topCandidates.map((c) => c.knowledgeItemId) },
      visibility: { in: allowedVisibilities },
    },
    include: {
      citations: true,
    },
  });

  // Compose answer from top items
  const answerParts: string[] = [];
  const citations: AnswerResult["citations"] = [];

  for (const candidate of topCandidates) {
    if (candidate.relevanceScore < CONFIDENCE_THRESHOLD) break;

    const item = relevantItems.find(
      (i) => i.id === candidate.knowledgeItemId,
    );
    if (!item) continue;

    answerParts.push(item.bodyMd);

    // Add citations from the item
    for (const cit of item.citations) {
      citations.push({
        knowledgeItemId: item.id,
        sourceId: cit.sourceId,
        quoteOrNote: cit.quoteOrNote,
        relevanceScore: candidate.relevanceScore,
      });
    }

    // If no formal citations, add the item itself as a citation
    if (item.citations.length === 0) {
      citations.push({
        knowledgeItemId: item.id,
        sourceId: null,
        quoteOrNote: item.topic,
        relevanceScore: candidate.relevanceScore,
      });
    }
  }

  const confidenceScore = Math.min(
    topCandidates.reduce((sum, c) => sum + c.relevanceScore, 0) /
      topCandidates.length,
    1,
  );

  return {
    answer: answerParts.join("\n\n"),
    citations,
    confidenceScore,
    escalated: false,
    escalationReason: null,
  };
}

// ── Helpers ──

function normalizeAndTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2); // skip very short words
}
