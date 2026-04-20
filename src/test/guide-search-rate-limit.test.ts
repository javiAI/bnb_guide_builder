import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  RetrievalResult,
  RetrievedItem,
} from "@/lib/services/assistant/retriever";

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

const { propertyFindUniqueMock, guideVersionFindFirstMock } = vi.hoisted(() => ({
  propertyFindUniqueMock: vi.fn(),
  guideVersionFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUnique: propertyFindUniqueMock },
    guideVersion: { findFirst: guideVersionFindFirstMock },
  },
}));

import {
  guideSemanticSearch,
  __resetRateLimitForTests,
  __guide_search_internal,
} from "@/lib/services/guide-search.service";

function empty(): RetrievalResult {
  return {
    items: [] as RetrievedItem[],
    degraded: false,
    stats: { scopeSize: 0, withEmbedding: 0, bm25Hits: 0, vectorHits: 0 },
  };
}

describe("guide-search service — rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T10:00:00.000Z"));
    __resetRateLimitForTests();
    vi.clearAllMocks();
    propertyFindUniqueMock.mockResolvedValue({ id: "prop_1", defaultLocale: "es" });
    guideVersionFindFirstMock.mockResolvedValue({ id: "gv_1" });
    hybridRetrieveMock.mockResolvedValue(empty());
  });

  it("allows exactly RATE_LIMIT_MAX_REQUESTS within the window, then 429s", async () => {
    const cap = __guide_search_internal.RATE_LIMIT_MAX_REQUESTS;
    for (let i = 0; i < cap; i += 1) {
      const r = await guideSemanticSearch({ slug: "demo", query: "wifi" });
      expect(r.kind).toBe("ok");
    }
    const rejected = await guideSemanticSearch({ slug: "demo", query: "wifi" });
    expect(rejected.kind).toBe("rate-limited");
    if (rejected.kind !== "rate-limited") throw new Error("unreachable");
    expect(rejected.retryAfterSeconds).toBeGreaterThan(0);
    expect(rejected.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("different slugs have independent buckets", async () => {
    const cap = __guide_search_internal.RATE_LIMIT_MAX_REQUESTS;
    for (let i = 0; i < cap; i += 1) {
      await guideSemanticSearch({ slug: "alpha", query: "wifi" });
    }
    const beta = await guideSemanticSearch({ slug: "beta", query: "wifi" });
    expect(beta.kind).toBe("ok");
    const alphaRejected = await guideSemanticSearch({ slug: "alpha", query: "wifi" });
    expect(alphaRejected.kind).toBe("rate-limited");
  });

  it("resets after the window elapses", async () => {
    const cap = __guide_search_internal.RATE_LIMIT_MAX_REQUESTS;
    for (let i = 0; i < cap; i += 1) {
      await guideSemanticSearch({ slug: "demo", query: "wifi" });
    }
    const rejected = await guideSemanticSearch({ slug: "demo", query: "wifi" });
    expect(rejected.kind).toBe("rate-limited");

    vi.advanceTimersByTime(__guide_search_internal.RATE_LIMIT_WINDOW_MS + 1_000);

    const afterWindow = await guideSemanticSearch({ slug: "demo", query: "wifi" });
    expect(afterWindow.kind).toBe("ok");
  });

  it("does not execute the retriever when rate-limited", async () => {
    const cap = __guide_search_internal.RATE_LIMIT_MAX_REQUESTS;
    for (let i = 0; i < cap; i += 1) {
      await guideSemanticSearch({ slug: "demo", query: "wifi" });
    }
    hybridRetrieveMock.mockClear();
    await guideSemanticSearch({ slug: "demo", query: "wifi" });
    expect(hybridRetrieveMock).not.toHaveBeenCalled();
  });
});
