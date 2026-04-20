// The retriever already enforces the visibility invariant (tested in
// `assistant-retriever-internals.test.ts`). This spec locks in the fact
// that the public guide-search service *always* calls it with
// audience='guest' + locale from the DB, regardless of what the caller
// tries to inject.

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

import { guideSemanticSearch, __resetRateLimitForTests } from "@/lib/services/guide-search.service";
import { allowedVisibilitiesFor } from "@/lib/services/assistant/retriever";

function emptyResult(): RetrievalResult {
  return {
    items: [] as RetrievedItem[],
    degraded: false,
    stats: { scopeSize: 0, withEmbedding: 0, bm25Hits: 0, vectorHits: 0 },
  };
}

describe("guide-search service — visibility invariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimitForTests();
    propertyFindUniqueMock.mockResolvedValue({ id: "prop_1", defaultLocale: "es" });
    guideVersionFindFirstMock.mockResolvedValue({ id: "gv_1" });
  });

  it("never forwards an audience other than 'guest'", async () => {
    hybridRetrieveMock.mockResolvedValue(emptyResult());
    await guideSemanticSearch({ slug: "demo", query: "cómo llego" });
    const [, filters] = hybridRetrieveMock.mock.calls[0] as [string, { audience: string }];
    expect(filters.audience).toBe("guest");
  });

  it("trusts the retriever's invariant: allowedVisibilitiesFor('guest') excludes sensitive", () => {
    expect(allowedVisibilitiesFor("guest")).not.toContain("sensitive");
  });

  it("never threads a locale from outside — it always comes from property.defaultLocale", async () => {
    hybridRetrieveMock.mockResolvedValue(emptyResult());
    propertyFindUniqueMock.mockResolvedValue({ id: "prop_1", defaultLocale: "fr" });

    await guideSemanticSearch({ slug: "demo", query: "comment arriver" });

    const [, filters] = hybridRetrieveMock.mock.calls[0] as [string, { locale: string }];
    expect(filters.locale).toBe("fr");
  });
});
