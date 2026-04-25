import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUnique: vi.fn() },
    space: { findMany: vi.fn() },
    propertyAmenityInstance: { findMany: vi.fn() },
    contact: { findMany: vi.fn() },
    localPlace: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth/require-operator", () => ({
  requireOperator: vi.fn().mockResolvedValue({
    userId: "test-user",
    workspaceId: "ws-1",
  }),
}));

// Skip the heavy PDF renderer — smoke-tests don't need a real PDF binary.
vi.mock("@/lib/renderers/guide-pdf", () => ({
  renderPdf: vi.fn(async () => Buffer.from("%PDF-1.4 fake", "utf8")),
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/properties/[propertyId]/guide/route";

const fn = <K extends keyof typeof prisma>(table: K, method: "findUnique" | "findMany") =>
  (prisma[table] as unknown as Record<string, ReturnType<typeof vi.fn>>)[method];

function makeReq(url: string) {
  return new Request(url) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-16T12:00:00.000Z"));
  fn("property", "findUnique").mockReset();
  fn("space", "findMany").mockResolvedValue([]);
  fn("propertyAmenityInstance", "findMany").mockResolvedValue([]);
  fn("contact", "findMany").mockResolvedValue([]);
  fn("localPlace", "findMany").mockResolvedValue([]);
  fn("property", "findUnique").mockImplementation(async (args: { where?: { id?: string }; select?: unknown }) => {
    // First call = ownership check (findUnique with no select); second = full property load.
    if (!args.select) {
      return args.where?.id ? { id: args.where.id, workspaceId: "ws-1" } : null;
    }
    // Full property load for guide rendering
    return {
      id: args.where?.id ?? "p1",
      workspaceId: "ws-1",
      checkInStart: null,
      checkInEnd: null,
      checkOutTime: null,
      primaryAccessMethod: null,
      accessMethodsJson: null,
      policiesJson: null,
    };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/properties/[propertyId]/guide", () => {
  it("returns 404 when property does not exist", async () => {
    fn("property", "findUnique").mockResolvedValueOnce(null);
    const res = await GET(
      makeReq("http://localhost/api/properties/missing/guide"),
      { params: Promise.resolve({ propertyId: "missing" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 with invalid audience", async () => {
    const res = await GET(
      makeReq("http://localhost/api/properties/p1/guide?audience=admin"),
      { params: Promise.resolve({ propertyId: "p1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 with invalid format", async () => {
    const res = await GET(
      makeReq("http://localhost/api/properties/p1/guide?format=xml"),
      { params: Promise.resolve({ propertyId: "p1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("json format returns tree with correct Content-Type", async () => {
    const res = await GET(
      makeReq("http://localhost/api/properties/p1/guide?audience=guest&format=json"),
      { params: Promise.resolve({ propertyId: "p1" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.propertyId).toBe("p1");
    expect(body.audience).toBe("guest");
    expect(body.sections).toBeDefined();
  });

  it("md format returns markdown text", async () => {
    const res = await GET(
      makeReq("http://localhost/api/properties/p1/guide?format=md"),
      { params: Promise.resolve({ propertyId: "p1" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const text = await res.text();
    // Default audience is guest — debug header is omitted for guest
    expect(text).not.toContain("# p1");
    // Should still contain markdown content (section headers)
    expect(text).toContain("##");
  });

  it("html format returns escaped HTML", async () => {
    const res = await GET(
      makeReq("http://localhost/api/properties/p1/guide?format=html"),
      { params: Promise.resolve({ propertyId: "p1" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("<article");
  });

  it("pdf format returns application/pdf with attachment header", async () => {
    const res = await GET(
      makeReq("http://localhost/api/properties/p1/guide?audience=internal&format=pdf"),
      { params: Promise.resolve({ propertyId: "p1" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("guide-p1-internal.pdf");
  });

  it("defaults to audience=guest and format=json when params omitted", async () => {
    const res = await GET(
      makeReq("http://localhost/api/properties/p1/guide"),
      { params: Promise.resolve({ propertyId: "p1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.audience).toBe("guest");
  });
});
