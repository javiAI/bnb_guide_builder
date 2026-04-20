import fs from "node:fs";
import path from "node:path";

import { ask } from "@/lib/services/assistant/pipeline";
import { __setEmbeddingProviderForTests } from "@/lib/services/assistant/embeddings.service";
import {
  __setRerankerForTests,
  resolveReranker,
} from "@/lib/services/assistant/reranker";
import {
  __setSynthesizerForTests,
  resolveSynthesizer,
} from "@/lib/services/assistant/synthesizer";
import {
  __setIntentResolverForTests,
  resolveIntentResolver,
} from "@/lib/services/assistant/intent-resolver";
import type { VisibilityLevel } from "@/lib/visibility";

import { seedEvalFixtures, teardownEvalFixtures } from "./property-seed";
import { SemanticBowEmbeddingProvider } from "./semantic-embeddings";
import {
  scoreFixture,
  summarise,
  type EvalSummary,
  type FixtureRun,
  type FixtureScore,
} from "./metrics";

interface Fixture {
  id: string;
  propertyId: string;
  language: "es" | "en";
  audience: VisibilityLevel;
  question: string;
  expectedItemIds: string[];
  expectedFacts: string[];
  journeyStage?: string | null;
  chunkType?: string | null;
}

export interface EvalReport {
  summary: EvalSummary;
  runs: FixtureRun[];
  scores: FixtureScore[];
}

const FIXTURES_PATH = path.join(__dirname, "fixtures.json");

function loadFixtures(): Fixture[] {
  const raw = fs.readFileSync(FIXTURES_PATH, "utf-8");
  const parsed = JSON.parse(raw) as { fixtures: Fixture[] };
  return parsed.fixtures;
}

// Resolvers compute a fingerprint from env keys; with the keys absent they
// pick the built-in stubs. We then pin those stubs explicitly so later calls
// short-circuit on the `__test__` fingerprint regardless of env state.
function pinDeterministicResolvers(): void {
  const prevCohere = process.env.COHERE_API_KEY;
  const prevAnthropic = process.env.ANTHROPIC_API_KEY;
  delete process.env.COHERE_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  __setEmbeddingProviderForTests(null);
  __setRerankerForTests(null);
  __setSynthesizerForTests(null);
  __setIntentResolverForTests(null);

  __setEmbeddingProviderForTests(new SemanticBowEmbeddingProvider());
  __setRerankerForTests(resolveReranker());
  __setSynthesizerForTests(resolveSynthesizer());
  __setIntentResolverForTests(resolveIntentResolver());

  if (prevCohere !== undefined) process.env.COHERE_API_KEY = prevCohere;
  if (prevAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = prevAnthropic;
}

function unpinResolvers(): void {
  __setEmbeddingProviderForTests(null);
  __setRerankerForTests(null);
  __setSynthesizerForTests(null);
  __setIntentResolverForTests(null);
}

export async function runEvalBank(): Promise<EvalReport> {
  pinDeterministicResolvers();
  try {
    await seedEvalFixtures();

    const fixtures = loadFixtures();
    const runs: FixtureRun[] = [];
    for (const fx of fixtures) {
      const result = await ask({
        propertyId: fx.propertyId,
        question: fx.question,
        language: fx.language,
        audience: fx.audience,
      });
      runs.push({
        id: fx.id,
        propertyId: fx.propertyId,
        language: fx.language,
        question: fx.question,
        expectedItemIds: fx.expectedItemIds,
        expectedFacts: fx.expectedFacts,
        journeyStage: fx.journeyStage ?? null,
        chunkType: fx.chunkType ?? null,
        answer: result.answer,
        citedItemIds: result.citations.map((c) => c.knowledgeItemId),
        escalated: result.escalated,
        escalationReason: result.escalationReason,
      });
    }

    const scores = runs.map(scoreFixture);
    const summary = summarise(runs, scores);
    return { summary, runs, scores };
  } finally {
    await teardownEvalFixtures();
    unpinResolvers();
  }
}
