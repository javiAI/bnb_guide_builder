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

function stubItem(overrides: Partial<RetrievedItem> = {}): RetrievedItem {
  return {
    id: "ki_1",
    propertyId: "prop_1",
    topic: "How to arrive",
    bodyMd: "Take the metro line 5 to Callao, then walk 3 minutes.",
    locale: "es",
    visibility: "guest",
    journeyStage: "arrival",
    chunkType: "procedure",
    entityType: "access",
    entityId: "access_1",
    canonicalQuestion: "¿Cómo llego al piso?",
    contextPrefix: "",
    tags: [],
    sourceFields: [],
    bm25Score: 0.5,
    vectorScore: 0.6,
    rrfScore: 0.032,
    ...overrides,
  };
}

function stubResult(items: RetrievedItem[]): RetrievalResult {
  return {
    items,
    degraded: false,
    stats: {
      scopeSize: 10,
      withEmbedding: 10,
      bm25Hits: items.length,
      vectorHits: items.length,
    },
  };
}

describe("guide-search service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimitForTests();
    propertyFindUniqueMock.mockResolvedValue({ id: "prop_1", defaultLocale: "es" });
    guideVersionFindFirstMock.mockResolvedValue({ id: "gv_1" });
  });

  it("maps an access hit to the arrival section with an item anchor", async () => {
    hybridRetrieveMock.mockResolvedValue(stubResult([stubItem()]));

    const result = await guideSemanticSearch({ slug: "demo", query: "cómo llego" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.hits).toHaveLength(1);
    const hit = result.data.hits[0];
    expect(hit.sectionId).toBe("gs.arrival");
    expect(hit.anchor).toBe("item-access_1");
    expect(hit.label).toBe("¿Cómo llego al piso?");
    expect(hit.sectionLabel).toBe("Llegada");
  });

  it("falls back to a section-level anchor when entityId is null", async () => {
    hybridRetrieveMock.mockResolvedValue(
      stubResult([stubItem({ entityId: null })]),
    );

    const result = await guideSemanticSearch({ slug: "demo", query: "cómo llego" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.hits[0].anchor).toBe("section-gs.arrival");
  });

  it("forces audience='guest' and locale from property.defaultLocale, ignoring any retriever knobs", async () => {
    hybridRetrieveMock.mockResolvedValue(stubResult([]));
    propertyFindUniqueMock.mockResolvedValue({ id: "prop_1", defaultLocale: "en" });

    await guideSemanticSearch({ slug: "demo", query: "wifi password" });

    expect(hybridRetrieveMock).toHaveBeenCalledTimes(1);
    const [, filters] = hybridRetrieveMock.mock.calls[0] as [string, { audience: string; locale: string }];
    expect(filters.audience).toBe("guest");
    expect(filters.locale).toBe("en");
  });

  it("overrides policy → checkout when journeyStage === 'checkout'", async () => {
    hybridRetrieveMock.mockResolvedValue(
      stubResult([
        stubItem({
          id: "ki_policy_checkout",
          entityType: "policy",
          entityId: "pol_1",
          journeyStage: "checkout",
          canonicalQuestion: "¿Cuándo tengo que irme?",
          topic: "Checkout window",
        }),
      ]),
    );

    const result = await guideSemanticSearch({ slug: "demo", query: "salida" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.hits[0].sectionId).toBe("gs.checkout");
  });

  it("defaults policy → rules without a checkout journeyStage", async () => {
    hybridRetrieveMock.mockResolvedValue(
      stubResult([
        stubItem({
          id: "ki_policy_rules",
          entityType: "policy",
          entityId: "pol_2",
          journeyStage: "stay",
          canonicalQuestion: "¿Se permiten mascotas?",
          topic: "Pet policy",
        }),
      ]),
    );

    const result = await guideSemanticSearch({ slug: "demo", query: "mascotas" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.hits[0].sectionId).toBe("gs.rules");
  });

  it("returns not-found when slug has no property", async () => {
    propertyFindUniqueMock.mockResolvedValue(null);
    const result = await guideSemanticSearch({ slug: "missing", query: "wifi" });
    expect(result.kind).toBe("not-found");
    expect(hybridRetrieveMock).not.toHaveBeenCalled();
  });

  it("returns not-found when the property has no published version", async () => {
    guideVersionFindFirstMock.mockResolvedValue(null);
    const result = await guideSemanticSearch({ slug: "draft", query: "wifi" });
    expect(result.kind).toBe("not-found");
    expect(hybridRetrieveMock).not.toHaveBeenCalled();
  });

  it("builds the snippet from canonicalQuestion when present", async () => {
    hybridRetrieveMock.mockResolvedValue(
      stubResult([stubItem({ canonicalQuestion: "¿Dónde dejo las llaves?" })]),
    );
    const result = await guideSemanticSearch({ slug: "demo", query: "llaves" });
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.data.hits[0].snippet).toBe("¿Dónde dejo las llaves?");
  });

  it("falls back to stripped bodyMd when canonicalQuestion is empty", async () => {
    hybridRetrieveMock.mockResolvedValue(
      stubResult([
        stubItem({
          canonicalQuestion: null,
          bodyMd: "**Wifi:** Casa_Claudia · *Password*: claudia2026\n\n- Usa banda 5GHz",
        }),
      ]),
    );
    const result = await guideSemanticSearch({ slug: "demo", query: "wifi" });
    if (result.kind !== "ok") throw new Error("expected ok");
    const snippet = result.data.hits[0].snippet;
    expect(snippet).toContain("Wifi:");
    expect(snippet).not.toContain("**");
    expect(snippet).not.toContain("\n");
    expect(snippet).not.toContain("- ");
  });

  it("truncates long snippets with an ellipsis", async () => {
    const longBody = "a".repeat(500);
    hybridRetrieveMock.mockResolvedValue(
      stubResult([stubItem({ canonicalQuestion: null, bodyMd: longBody })]),
    );
    const result = await guideSemanticSearch({ slug: "demo", query: "x" });
    if (result.kind !== "ok") throw new Error("expected ok");
    const snippet = result.data.hits[0].snippet;
    expect(snippet.length).toBeLessThanOrEqual(
      __guide_search_internal.SNIPPET_MAX_LENGTH,
    );
    expect(snippet.endsWith("…")).toBe(true);
  });
});
