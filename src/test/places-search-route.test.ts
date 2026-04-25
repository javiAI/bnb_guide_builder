import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth/require-operator", () => ({
  requireOperator: vi.fn().mockResolvedValue({
    userId: "test-user",
    workspaceId: "ws-1",
  }),
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/properties/[propertyId]/places-search/route";
import { __resetPlacesRateLimitForTests } from "@/lib/services/places/rate-limit";
import {
  __setLocalPoiProviderForTests,
  PoiProviderUnavailableError,
  type LocalPoiProvider,
} from "@/lib/services/places";
import { MockPlacesProvider } from "@/lib/services/places/mock-provider";

const findUnique = prisma.property.findUnique as unknown as ReturnType<typeof vi.fn>;

import { NextRequest } from "next/server";

function req(url: string) {
  return new NextRequest(url);
}

function ctx(propertyId: string) {
  return { params: Promise.resolve({ propertyId }) };
}

beforeEach(() => {
  __resetPlacesRateLimitForTests();
  __setLocalPoiProviderForTests(new MockPlacesProvider());
  findUnique.mockReset();
});

afterEach(() => {
  __setLocalPoiProviderForTests(null);
});

describe("GET /api/properties/:propertyId/places-search", () => {
  it("returns 400 on missing query", async () => {
    findUnique.mockResolvedValue({
      id: "p1",
      workspaceId: "ws-1",
      latitude: 41.385,
      longitude: 2.173,
    });
    const res = await GET(
      req("http://x/api/properties/p1/places-search"),
      ctx("p1"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_query");
  });

  it("returns 400 on query shorter than 2 chars", async () => {
    findUnique.mockResolvedValue({
      id: "p1",
      workspaceId: "ws-1",
      latitude: 41.385,
      longitude: 2.173,
    });
    const res = await GET(
      req("http://x/api/properties/p1/places-search?q=r"),
      ctx("p1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when property does not exist", async () => {
    findUnique.mockResolvedValue(null);
    const res = await GET(
      req("http://x/api/properties/p1/places-search?q=restaurante"),
      ctx("p1"),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when property has no coordinates", async () => {
    findUnique.mockResolvedValue({
      id: "p1",
      workspaceId: "ws-1",
      latitude: null,
      longitude: null,
    });
    const res = await GET(
      req("http://x/api/properties/p1/places-search?q=restaurante"),
      ctx("p1"),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("property_missing_coordinates");
  });

  it("returns 200 with suggestions from the configured provider", async () => {
    findUnique.mockResolvedValue({
      id: "p1",
      workspaceId: "ws-1",
      latitude: 41.385,
      longitude: 2.173,
    });
    const res = await GET(
      req("http://x/api/properties/p1/places-search?q=restaurante"),
      ctx("p1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("mock");
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.suggestions.length).toBeGreaterThan(0);
    for (const s of body.suggestions) {
      expect(s.categoryKey).toMatch(/^lp\./);
      expect(s.provider).toBe("mock");
    }
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 502 when the provider throws PoiProviderUnavailableError", async () => {
    findUnique.mockResolvedValue({
      id: "p1",
      workspaceId: "ws-1",
      latitude: 41.385,
      longitude: 2.173,
    });
    const failing: LocalPoiProvider = {
      name: "mock",
      search: async () => {
        throw new PoiProviderUnavailableError("upstream down", "mock");
      },
    };
    __setLocalPoiProviderForTests(failing);

    const res = await GET(
      req("http://x/api/properties/p1/places-search?q=cafe"),
      ctx("p1"),
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("provider_unavailable");
  });

  it("rate-limits after 30 requests within the window", async () => {
    findUnique.mockResolvedValue({
      id: "p1",
      workspaceId: "ws-1",
      latitude: 41.385,
      longitude: 2.173,
    });
    for (let i = 0; i < 30; i += 1) {
      const ok = await GET(
        req("http://x/api/properties/p1/places-search?q=cafe"),
        ctx("p1"),
      );
      expect(ok.status).toBe(200);
    }
    const res = await GET(
      req("http://x/api/properties/p1/places-search?q=cafe"),
      ctx("p1"),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
    expect(typeof body.retryAfterSeconds).toBe("number");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("scopes rate limit per propertyId", async () => {
    findUnique.mockResolvedValue({
      id: "p1",
      workspaceId: "ws-1",
      latitude: 41.385,
      longitude: 2.173,
    });
    for (let i = 0; i < 30; i += 1) {
      await GET(
        req("http://x/api/properties/p1/places-search?q=cafe"),
        ctx("p1"),
      );
    }
    findUnique.mockResolvedValue({
      id: "p2",
      workspaceId: "ws-1",
      latitude: 41.385,
      longitude: 2.173,
    });
    const res = await GET(
      req("http://x/api/properties/p2/places-search?q=cafe"),
      ctx("p2"),
    );
    expect(res.status).toBe(200);
  });
});
