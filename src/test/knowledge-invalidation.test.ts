import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  invalidateKnowledge,
  deleteEntityChunks,
} from "@/lib/services/knowledge-extract.service";

// Verify that invalidation scopes the incremental upsert to the correct
// entityType/entityId and does not touch items from other entity types.
// Under Rama 11C's incremental semantics, the `findMany` call carries the
// scope where; per-row deletes happen by id lists.

const {
  findManyMock,
  deleteManyMock,
  createManyMock,
  updateMock,
  executeRawMock,
  transactionMock,
} = vi.hoisted(() => {
  const findManyMock = vi.fn().mockResolvedValue([]);
  const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 });
  const createManyMock = vi.fn().mockResolvedValue({ count: 0 });
  const updateMock = vi.fn().mockResolvedValue({});
  const executeRawMock = vi.fn().mockResolvedValue(0);
  const transactionMock = vi.fn().mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) await op;
  });
  return {
    findManyMock,
    deleteManyMock,
    createManyMock,
    updateMock,
    executeRawMock,
    transactionMock,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transactionMock,
    $executeRaw: executeRawMock,
    knowledgeItem: {
      findMany: findManyMock,
      deleteMany: deleteManyMock,
      createMany: createManyMock,
      update: updateMock,
    },
    property: {
      findUnique: vi.fn().mockResolvedValue({ defaultLocale: "es" }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        propertyNickname: "Apartamento Sol",
        propertyType: "pt.apartment",
        city: "Málaga",
        country: "España",
        checkInStart: "15:00",
        checkInEnd: "21:00",
        checkOutTime: "11:00",
        maxGuests: 4,
        maxAdults: 4,
        maxChildren: 0,
        infantsAllowed: false,
        isAutonomousCheckin: false,
        primaryAccessMethod: "am.lockbox",
        accessMethodsJson: { unit: { methods: ["am.lockbox"] } },
        hasBuildingAccess: false,
        policiesJson: null,
      }),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    propertyAmenityInstance: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    space: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    propertySystem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

beforeEach(() => {
  findManyMock.mockClear();
  findManyMock.mockResolvedValue([]);
  deleteManyMock.mockClear();
  createManyMock.mockClear();
  updateMock.mockClear();
  executeRawMock.mockClear();
  transactionMock.mockClear();
});

describe("invalidateKnowledge — entity type scoping", () => {
  it("invalidating 'access' section scopes findMany by entityType=access", async () => {
    await invalidateKnowledge("prop_1", "access", null);

    const scope = findManyMock.mock.calls[0]?.[0]?.where;
    expect(scope?.entityType).toBe("access");
    expect(scope?.propertyId).toBe("prop_1");
    expect(scope?.locale).toBe("es");
    expect(scope?.isAutoExtracted).toBe(true);
  });

  it("invalidating 'property' section scopes findMany by entityType=property", async () => {
    await invalidateKnowledge("prop_1", "property", null);
    const scope = findManyMock.mock.calls[0]?.[0]?.where;
    expect(scope?.entityType).toBe("property");
  });

  it("invalidating a specific contact passes its entityId in the scope", async () => {
    await invalidateKnowledge("prop_1", "contact", "contact_abc");
    const scope = findManyMock.mock.calls[0]?.[0]?.where;
    expect(scope?.entityType).toBe("contact");
    expect(scope?.entityId).toBe("contact_abc");
  });

  it("invalidating 'amenity' never queries the 'contact' section", async () => {
    await invalidateKnowledge("prop_1", "amenity", null);
    const scopes = findManyMock.mock.calls.map((c) => c[0]?.where);
    expect(scopes.find((s) => s?.entityType === "contact")).toBeUndefined();
  });

  it("nulls the embedding when contentHash changes on an existing row", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "ki_1",
        entityType: "property",
        entityId: null,
        templateKey: "capacity",
        contentHash: "STALEHASH00000000",
      },
    ]);

    await invalidateKnowledge("prop_1", "property", null);

    expect(updateMock).toHaveBeenCalled();
    expect(executeRawMock).toHaveBeenCalled();
  });

  it("preserves the embedding when contentHash is unchanged", async () => {
    // First run: capture the hash the extractor produces for a stable row.
    await invalidateKnowledge("prop_1", "property", null);
    const createdData = createManyMock.mock.calls[0]?.[0]?.data as Array<{
      templateKey: string;
      contentHash: string;
      entityType: string;
      entityId: string | null;
    }>;
    const stable = createdData?.find((d) => d.templateKey === "capacity");
    expect(stable).toBeDefined();

    // Second run: feed the same row back as "existing" with matching hash.
    findManyMock.mockReset();
    findManyMock.mockResolvedValue([
      {
        id: "ki_capacity",
        entityType: stable!.entityType,
        entityId: stable!.entityId,
        templateKey: stable!.templateKey,
        contentHash: stable!.contentHash,
      },
    ]);
    updateMock.mockClear();
    executeRawMock.mockClear();

    await invalidateKnowledge("prop_1", "property", null);

    // Row still gets updated (metadata may have moved), but embedding is kept.
    expect(executeRawMock).not.toHaveBeenCalled();
  });
});

describe("deleteEntityChunks", () => {
  it("deletes by propertyId + entityType + entityId", async () => {
    await deleteEntityChunks("prop_1", "space", "space_xyz");

    expect(deleteManyMock).toHaveBeenCalledWith({
      where: {
        propertyId: "prop_1",
        entityType: "space",
        entityId: "space_xyz",
      },
    });
  });

  it("does not call createMany (delete only, no re-extract)", async () => {
    await deleteEntityChunks("prop_1", "amenity", "ami_123");
    expect(createManyMock).not.toHaveBeenCalled();
  });
});
