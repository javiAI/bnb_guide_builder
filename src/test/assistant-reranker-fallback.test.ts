import { describe, it, expect, afterEach, vi } from "vitest";
import {
  resolveReranker,
  __setRerankerForTests,
} from "@/lib/services/assistant/reranker";
import type { RetrievedItem } from "@/lib/services/assistant/retriever";

function stubItem(overrides: Partial<RetrievedItem> = {}): RetrievedItem {
  return {
    id: "ki_1",
    propertyId: "prop_1",
    topic: "Topic",
    bodyMd: "body",
    locale: "es",
    visibility: "guest",
    journeyStage: "any",
    chunkType: "fact",
    entityType: "property",
    entityId: null,
    canonicalQuestion: null,
    contextPrefix: "prefix",
    tags: [],
    sourceFields: [],
    bm25Score: 0,
    vectorScore: 0,
    rrfScore: 0.03,
    ...overrides,
  };
}

describe("reranker — identity fallback (dev/test, no key)", () => {
  afterEach(() => {
    __setRerankerForTests(null);
    vi.unstubAllEnvs();
  });

  it("returns items in RRF order with rerankScore scaled to [0,1]", async () => {
    __setRerankerForTests(null);
    const reranker = resolveReranker();
    expect(reranker.modelId).toBe("identity:passthrough");

    const items = [
      stubItem({ id: "a", rrfScore: 0.06 }),
      stubItem({ id: "b", rrfScore: 0.03 }),
      stubItem({ id: "c", rrfScore: 0.015 }),
    ];
    const out = await reranker.rerank("q", items, 5);
    expect(out.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(out[0].rerankScore).toBeCloseTo(1, 5);
    expect(out[1].rerankScore).toBeCloseTo(0.5, 3);
    expect(out[2].rerankScore).toBeCloseTo(0.25, 3);
  });

  it("honors topN cap", async () => {
    __setRerankerForTests(null);
    const reranker = resolveReranker();
    const items = Array.from({ length: 10 }, (_, i) =>
      stubItem({ id: `k${i}`, rrfScore: 0.1 - i * 0.01 }),
    );
    const out = await reranker.rerank("q", items, 3);
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.id)).toEqual(["k0", "k1", "k2"]);
  });

  it("throws in production without COHERE_API_KEY", () => {
    __setRerankerForTests(null);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COHERE_API_KEY", "");
    expect(() => resolveReranker()).toThrow(/COHERE_API_KEY/);
  });
});
