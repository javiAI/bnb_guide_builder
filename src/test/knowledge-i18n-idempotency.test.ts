import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractFromPropertyAll } from "@/lib/services/knowledge-extract.service";

// Verify that:
// 1. extractFromPropertyAll scopes its findMany to the requested locale
//    (never sees items from another locale)
// 2. Under incremental upsert semantics (Rama 11C), a second run with
//    matching contentHash produces no deletions and no embedding nulls —
//    i.e. the pipeline preserves embeddings across idempotent re-extractions.

const {
  baseProperty,
  findManyMock,
  deleteManyMock,
  createManyMock,
  updateMock,
  executeRawMock,
} = vi.hoisted(() => ({
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
  findManyMock: vi.fn().mockResolvedValue([]),
  deleteManyMock: vi.fn().mockResolvedValue({ count: 0 }),
  createManyMock: vi.fn().mockResolvedValue({ count: 0 }),
  updateMock: vi.fn().mockResolvedValue({}),
  executeRawMock: vi.fn().mockResolvedValue(0),
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
      findMany: findManyMock,
      deleteMany: deleteManyMock,
      createMany: createManyMock,
      update: updateMock,
    },
    $executeRaw: executeRawMock,
    $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  },
}));

beforeEach(() => {
  findManyMock.mockClear();
  findManyMock.mockResolvedValue([]);
  deleteManyMock.mockClear();
  createManyMock.mockClear();
  updateMock.mockClear();
  executeRawMock.mockClear();
});

describe("extractFromPropertyAll — locale-scoped incremental", () => {
  it("scopes findMany to locale='en' when extracting in English", async () => {
    await extractFromPropertyAll("prop_1", "en");

    const scope = findManyMock.mock.calls[0]?.[0]?.where;
    expect(scope?.locale).toBe("en");
    expect(scope?.propertyId).toBe("prop_1");
    expect(scope?.isAutoExtracted).toBe(true);
  });

  it("scopes findMany to locale='es' when extracting in Spanish", async () => {
    await extractFromPropertyAll("prop_1", "es");
    const scope = findManyMock.mock.calls[0]?.[0]?.where;
    expect(scope?.locale).toBe("es");
  });

  it("never queries locale='es' when extracting locale='en'", async () => {
    await extractFromPropertyAll("prop_1", "en");
    const scopes = findManyMock.mock.calls.map((c) => c[0]?.where);
    expect(scopes.find((s) => s?.locale === "es")).toBeUndefined();
  });

  it("re-running with unchanged content does not null any embedding", async () => {
    // First pass: capture the chunks the extractor produced.
    await extractFromPropertyAll("prop_1", "es");
    const created = (createManyMock.mock.calls[0]?.[0]?.data ?? []) as Array<{
      entityType: string;
      entityId: string | null;
      templateKey: string;
      contentHash: string;
    }>;
    expect(created.length).toBeGreaterThan(0);

    // Second pass: feed them back as "existing" with identical hashes.
    findManyMock.mockReset();
    findManyMock.mockResolvedValue(
      created.map((c, i) => ({
        id: `ki_${i}`,
        entityType: c.entityType,
        entityId: c.entityId,
        templateKey: c.templateKey,
        contentHash: c.contentHash,
      })),
    );
    createManyMock.mockClear();
    deleteManyMock.mockClear();
    executeRawMock.mockClear();

    await extractFromPropertyAll("prop_1", "es");

    // Idempotent: same content → no new rows, no deletions, no embedding nulls.
    expect(createManyMock).not.toHaveBeenCalled();
    expect(deleteManyMock).not.toHaveBeenCalled();
    expect(executeRawMock).not.toHaveBeenCalled();
  });
});
