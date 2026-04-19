import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractFromPropertyAll } from "@/lib/services/knowledge-extract.service";

// Verify that:
// 1. extracting "en" scopes its delete to locale="en" (does not delete "es" items)
// 2. extracting the same locale twice calls deleteMany once per run — idempotent

const { baseProperty, deleteManyMock, createManyMock } = vi.hoisted(() => ({
  baseProperty: {
    propertyNickname: "Test Property",
    city: "Barcelona",
    country: "Spain",
    checkInStart: "15:00",
    checkInEnd: "21:00",
    checkOutTime: "11:00",
    maxGuests: 2,
    maxAdults: 2,
    maxChildren: 0,
    infantsAllowed: false,
    isAutonomousCheckin: false,
    primaryAccessMethod: "am.lockbox",
    accessMethodsJson: { unit: { methods: ["am.lockbox"] }, building: null },
    hasBuildingAccess: false,
    policiesJson: null,
  },
  deleteManyMock: vi.fn().mockResolvedValue({ count: 0 }),
  createManyMock: vi.fn().mockResolvedValue({ count: 0 }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(baseProperty),
    },
    contact: { findMany: vi.fn().mockResolvedValue([]) },
    propertyAmenityInstance: { findMany: vi.fn().mockResolvedValue([]) },
    space: { findMany: vi.fn().mockResolvedValue([]) },
    propertySystem: { findMany: vi.fn().mockResolvedValue([]) },
    knowledgeItem: {
      deleteMany: deleteManyMock,
      createMany: createManyMock,
    },
    $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  },
}));

beforeEach(() => {
  deleteManyMock.mockClear();
  createManyMock.mockClear();
});

describe("extractFromPropertyAll — locale-scoped delete", () => {
  it("extracting locale=en scopes deleteMany to locale='en' only", async () => {
    await extractFromPropertyAll("prop_1", "en");

    const deleteCalls = deleteManyMock.mock.calls as Array<[{ where: Record<string, unknown> }]>;
    expect(deleteCalls.length).toBeGreaterThan(0);
    for (const [args] of deleteCalls) {
      expect(args.where.locale).toBe("en");
      expect(args.where.propertyId).toBe("prop_1");
      expect(args.where.isAutoExtracted).toBe(true);
    }
  });

  it("extracting locale=es scopes deleteMany to locale='es' only", async () => {
    await extractFromPropertyAll("prop_1", "es");

    const deleteCalls = deleteManyMock.mock.calls as Array<[{ where: Record<string, unknown> }]>;
    expect(deleteCalls.length).toBeGreaterThan(0);
    for (const [args] of deleteCalls) {
      expect(args.where.locale).toBe("es");
    }
  });

  it("deleteMany is never called with locale='es' when extracting locale='en'", async () => {
    await extractFromPropertyAll("prop_1", "en");

    const deleteCalls = deleteManyMock.mock.calls as Array<[{ where: Record<string, unknown> }]>;
    const esDeletes = deleteCalls.filter(([args]) => args.where.locale === "es");
    expect(esDeletes).toHaveLength(0);
  });

  it("extracting the same locale twice calls deleteMany exactly twice (one per run)", async () => {
    await extractFromPropertyAll("prop_1", "es");
    const firstRunDeletes = deleteManyMock.mock.calls.length;
    expect(firstRunDeletes).toBe(1);

    await extractFromPropertyAll("prop_1", "es");
    const secondRunDeletes = deleteManyMock.mock.calls.length;
    // Each run adds exactly 1 deleteMany call
    expect(secondRunDeletes).toBe(2);
  });
});
