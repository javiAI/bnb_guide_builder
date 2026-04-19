import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ask, retrieve } from "@/lib/services/assistant/pipeline";
import {
  __setRerankerForTests,
  type Reranker,
  type RerankedItem,
} from "@/lib/services/assistant/reranker";
import {
  __setSynthesizerForTests,
  type Synthesizer,
  type SynthesizerOutput,
} from "@/lib/services/assistant/synthesizer";
import {
  __setIntentResolverForTests,
  type IntentResolver,
} from "@/lib/services/assistant/intent-resolver";
import type { RetrievedItem, RetrievalResult } from "@/lib/services/assistant/retriever";

// We stub the three resolvable services + the retriever SQL so the pipeline
// can be exercised end-to-end without a database or real API keys.

const hybridRetrieveMock = vi.fn<
  (query: string, filters: unknown, opts?: unknown) => Promise<RetrievalResult>
>();

vi.mock("@/lib/services/assistant/retriever", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/assistant/retriever")>(
    "@/lib/services/assistant/retriever",
  );
  return {
    ...actual,
    hybridRetrieve: (q: string, f: unknown, o?: unknown) =>
      hybridRetrieveMock(q, f, o),
  };
});

const { assistantMessageCreateMock, conversationCreateMock, conversationFindMock, transactionMock } =
  vi.hoisted(() => {
    const assistantMessageCreateMock = vi.fn().mockResolvedValue({});
    const conversationCreateMock = vi.fn().mockResolvedValue({ id: "conv_new" });
    const conversationFindMock = vi.fn().mockResolvedValue(null);
    const tx = {
      assistantConversation: {
        create: conversationCreateMock,
        findFirst: conversationFindMock,
      },
      assistantMessage: {
        create: assistantMessageCreateMock,
      },
    };
    const transactionMock = vi.fn(
      async (
        arg:
          | Array<Promise<unknown>>
          | ((tx: typeof import("@/lib/db").prisma) => Promise<unknown>),
      ) => {
        if (typeof arg === "function") {
          return arg(tx as unknown as typeof import("@/lib/db").prisma);
        }
        return Promise.all(arg);
      },
    );
    return { assistantMessageCreateMock, conversationCreateMock, conversationFindMock, transactionMock };
  });

vi.mock("@/lib/db", () => ({
  prisma: {
    assistantConversation: {
      create: conversationCreateMock,
      findFirst: conversationFindMock,
    },
    assistantMessage: {
      create: assistantMessageCreateMock,
    },
    $transaction: transactionMock,
  },
}));

// ── fixtures ─────────────────────────────────────────────────────────────

function retrievedItem(overrides: Partial<RetrievedItem> = {}): RetrievedItem {
  return {
    id: "ki_1",
    propertyId: "prop_1",
    topic: "WiFi",
    bodyMd: "The wifi password is 1234.",
    locale: "es",
    visibility: "guest",
    journeyStage: "stay",
    chunkType: "fact",
    entityType: "system",
    entityId: null,
    canonicalQuestion: null,
    contextPrefix: "Property: Test.\nSection: Systems > WiFi.",
    tags: [],
    sourceFields: [],
    bm25Score: 0.3,
    vectorScore: 0.8,
    rrfScore: 0.03,
    ...overrides,
  };
}

class StubReranker implements Reranker {
  readonly modelId = "stub:reranker";
  constructor(private floor: number = 0.9) {}
  async rerank(_q: string, items: RetrievedItem[], topN: number): Promise<RerankedItem[]> {
    return items
      .slice(0, topN)
      .map((it) => ({ ...it, rerankScore: this.floor }));
  }
}

class StubSynth implements Synthesizer {
  readonly modelId = "stub:synth";
  constructor(private out: SynthesizerOutput) {}
  async synthesize(): Promise<SynthesizerOutput> {
    return this.out;
  }
}

class StubIntent implements IntentResolver {
  readonly modelId = "stub:intent";
  constructor(
    private stage: "pre_arrival" | "arrival" | "stay" | "checkout" | "post_checkout" | "any" = "stay",
    private confidence = 0.9,
  ) {}
  async resolve() {
    return { journeyStage: this.stage, confidence: this.confidence, modelId: this.modelId };
  }
}

// ── tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  hybridRetrieveMock.mockReset();
  assistantMessageCreateMock.mockClear();
  conversationCreateMock.mockClear();
  conversationCreateMock.mockResolvedValue({ id: "conv_new" });
  conversationFindMock.mockClear();
  conversationFindMock.mockResolvedValue(null);
  transactionMock.mockClear();
});

afterEach(() => {
  __setRerankerForTests(null);
  __setSynthesizerForTests(null);
  __setIntentResolverForTests(null);
});

describe("pipeline.ask — escalation paths", () => {
  it("escalates when retrieval returns no candidates", async () => {
    hybridRetrieveMock.mockResolvedValue({
      items: [],
      degraded: false,
      stats: { scopeSize: 0, withEmbedding: 0, bm25Hits: 0, vectorHits: 0 },
    });
    __setRerankerForTests(new StubReranker());
    __setSynthesizerForTests(
      new StubSynth({
        answer: "unused",
        citations: [{ knowledgeItemId: "x", sourceType: "system" as const, entityLabel: "l", score: 1 }],
        escalated: false,
        escalationReason: null,
        confidenceScore: 1,
      }),
    );
    __setIntentResolverForTests(new StubIntent());

    const out = await ask({
      propertyId: "prop_1",
      question: "wifi?",
      language: "es",
      audience: "guest",
    });

    expect(out.escalated).toBe(true);
    expect(out.escalationReason).toMatch(/no retrieval candidates/i);
    expect(out.citations).toHaveLength(0);
  });

  it("surfaces 'still indexing' reason when retrieval is degraded", async () => {
    hybridRetrieveMock.mockResolvedValue({
      items: [],
      degraded: true,
      stats: { scopeSize: 100, withEmbedding: 0, bm25Hits: 0, vectorHits: 0 },
    });
    __setRerankerForTests(new StubReranker());
    __setSynthesizerForTests(
      new StubSynth({
        answer: "",
        citations: [],
        escalated: true,
        escalationReason: "x",
        confidenceScore: 0,
      }),
    );
    __setIntentResolverForTests(new StubIntent());

    const out = await ask({
      propertyId: "prop_1",
      question: "wifi?",
      language: "es",
      audience: "guest",
    });

    expect(out.escalated).toBe(true);
    expect(out.escalationReason).toMatch(/indexing/i);
    expect(out.debug.retrieval.degraded).toBe(true);
  });

  it("passes through synthesizer escalations (e.g. ESCALATE: from LLM)", async () => {
    hybridRetrieveMock.mockResolvedValue({
      items: [retrievedItem()],
      degraded: false,
      stats: { scopeSize: 1, withEmbedding: 1, bm25Hits: 1, vectorHits: 1 },
    });
    __setRerankerForTests(new StubReranker());
    __setSynthesizerForTests(
      new StubSynth({
        answer: "",
        citations: [],
        escalated: true,
        escalationReason: "off-topic for this property",
        confidenceScore: 0,
      }),
    );
    __setIntentResolverForTests(new StubIntent());

    const out = await ask({
      propertyId: "prop_1",
      question: "weather?",
      language: "es",
      audience: "guest",
    });

    expect(out.escalated).toBe(true);
    expect(out.escalationReason).toBe("off-topic for this property");
  });
});

describe("pipeline.ask — happy path + persistence", () => {
  beforeEach(() => {
    hybridRetrieveMock.mockResolvedValue({
      items: [retrievedItem(), retrievedItem({ id: "ki_2" })],
      degraded: false,
      stats: { scopeSize: 2, withEmbedding: 2, bm25Hits: 2, vectorHits: 2 },
    });
    __setRerankerForTests(new StubReranker(0.95));
    __setSynthesizerForTests(
      new StubSynth({
        answer: "Es 1234 [1].",
        citations: [
          { knowledgeItemId: "ki_1", sourceType: "system", entityLabel: "WiFi", score: 0.95 },
        ],
        escalated: false,
        escalationReason: null,
        confidenceScore: 0.5,
      }),
    );
    __setIntentResolverForTests(new StubIntent());
  });

  it("creates a new conversation when none is supplied", async () => {
    const out = await ask({
      propertyId: "prop_1",
      question: "¿Cuál es la wifi?",
      language: "es",
      audience: "guest",
    });

    expect(conversationCreateMock).toHaveBeenCalledTimes(1);
    expect(out.conversationId).toBe("conv_new");
    expect(assistantMessageCreateMock).toHaveBeenCalledTimes(2); // user + assistant
  });

  it("reuses an existing conversation when id is supplied and valid", async () => {
    conversationFindMock.mockResolvedValueOnce({ id: "conv_prev" });

    const out = await ask({
      propertyId: "prop_1",
      question: "y la calefacción?",
      language: "es",
      audience: "guest",
      conversationId: "conv_prev",
    });

    expect(conversationFindMock).toHaveBeenCalledWith({
      where: { id: "conv_prev", propertyId: "prop_1" },
      select: { id: true },
    });
    expect(conversationCreateMock).not.toHaveBeenCalled();
    expect(out.conversationId).toBe("conv_prev");
  });

  it("creates a new conversation when the id belongs to another property", async () => {
    // Cross-property conversationId must NEVER attach history to this property.
    conversationFindMock.mockResolvedValueOnce(null);

    const out = await ask({
      propertyId: "prop_1",
      question: "¿Cuál es la wifi?",
      language: "es",
      audience: "guest",
      conversationId: "conv_from_other_property",
    });

    expect(conversationCreateMock).toHaveBeenCalledTimes(1);
    expect(out.conversationId).toBe("conv_new");
  });
});

describe("pipeline.ask — reranker floor", () => {
  it("drops candidates below 0.3 when at least one survives the floor", async () => {
    hybridRetrieveMock.mockResolvedValue({
      items: [retrievedItem(), retrievedItem({ id: "ki_2" })],
      degraded: false,
      stats: { scopeSize: 2, withEmbedding: 2, bm25Hits: 2, vectorHits: 2 },
    });

    const synth = vi.fn(async (input: { items: RerankedItem[] }) => {
      void input;
      return {
        answer: "A [1].",
        citations: [
          { knowledgeItemId: "ki_1", sourceType: "system" as const, entityLabel: "WiFi", score: 0.85 },
        ],
        escalated: false,
        escalationReason: null,
        confidenceScore: 1,
      };
    });
    __setSynthesizerForTests({ modelId: "stub:synth", synthesize: synth });

    // One above floor, one below.
    __setRerankerForTests({
      modelId: "stub",
      async rerank(_q, items) {
        return [
          { ...items[0], rerankScore: 0.85 },
          { ...items[1], rerankScore: 0.15 },
        ];
      },
    });
    __setIntentResolverForTests(new StubIntent());

    await ask({
      propertyId: "p",
      question: "q",
      language: "es",
      audience: "guest",
    });

    const synthCall = synth.mock.calls[0]?.[0];
    expect(synthCall?.items).toHaveLength(1);
    expect(synthCall?.items[0].id).toBe("ki_1");
  });
});

describe("pipeline.ask — intent threshold pushdown", () => {
  it("passes stage filter to retriever when confidence >= 0.7", async () => {
    hybridRetrieveMock.mockResolvedValue({
      items: [retrievedItem()],
      degraded: false,
      stats: { scopeSize: 1, withEmbedding: 1, bm25Hits: 1, vectorHits: 1 },
    });
    __setRerankerForTests(new StubReranker());
    __setSynthesizerForTests(
      new StubSynth({
        answer: "A [1].",
        citations: [{ knowledgeItemId: "ki_1", sourceType: "system" as const, entityLabel: "l", score: 1 }],
        escalated: false,
        escalationReason: null,
        confidenceScore: 1,
      }),
    );
    __setIntentResolverForTests(new StubIntent("arrival", 0.9));

    await ask({ propertyId: "p", question: "how to check in", language: "es", audience: "guest" });
    const filters = hybridRetrieveMock.mock.calls[0]?.[1] as { journeyStage?: string };
    expect(filters.journeyStage).toBe("arrival");
  });

  it("omits stage filter when confidence below threshold", async () => {
    hybridRetrieveMock.mockResolvedValue({
      items: [retrievedItem()],
      degraded: false,
      stats: { scopeSize: 1, withEmbedding: 1, bm25Hits: 1, vectorHits: 1 },
    });
    __setRerankerForTests(new StubReranker());
    __setSynthesizerForTests(
      new StubSynth({
        answer: "A [1].",
        citations: [{ knowledgeItemId: "ki_1", sourceType: "system" as const, entityLabel: "l", score: 1 }],
        escalated: false,
        escalationReason: null,
        confidenceScore: 1,
      }),
    );
    __setIntentResolverForTests(new StubIntent("stay", 0.4));

    await ask({ propertyId: "p", question: "something vague", language: "es", audience: "guest" });
    const filters = hybridRetrieveMock.mock.calls[0]?.[1] as { journeyStage?: string | null };
    expect(filters.journeyStage).toBeNull();
  });
});

describe("pipeline.retrieve (debug endpoint shape)", () => {
  it("returns ranked items + intent + retrieval stats", async () => {
    hybridRetrieveMock.mockResolvedValue({
      items: [retrievedItem(), retrievedItem({ id: "ki_2" })],
      degraded: false,
      stats: { scopeSize: 2, withEmbedding: 2, bm25Hits: 2, vectorHits: 2 },
    });
    __setRerankerForTests(new StubReranker(0.8));
    __setIntentResolverForTests(new StubIntent("stay", 0.85));

    const out = await retrieve({
      propertyId: "p",
      question: "q",
      language: "es",
      audience: "guest",
    });

    expect(out.items).toHaveLength(2);
    expect(out.items[0].rerankScore).toBe(0.8);
    expect(out.intent.journeyStage).toBe("stay");
    expect(out.retrieval.scopeSize).toBe(2);
    expect(out.retrieval.degraded).toBe(false);
  });
});
