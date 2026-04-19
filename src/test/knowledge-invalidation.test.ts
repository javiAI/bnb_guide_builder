import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  invalidateKnowledge,
  deleteEntityChunks,
} from "@/lib/services/knowledge-extract.service";

// Verify that invalidation targets the correct entity type section and
// does not touch items from other entity types.

const { deleteManyMock, createManyMock, transactionMock } = vi.hoisted(() => {
  const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 });
  const createManyMock = vi.fn().mockResolvedValue({ count: 0 });
  const transactionMock = vi.fn().mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) {
      await op;
    }
  });
  return { deleteManyMock, createManyMock, transactionMock };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transactionMock,
    knowledgeItem: {
      deleteMany: deleteManyMock,
      createMany: createManyMock,
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
  deleteManyMock.mockClear();
  createManyMock.mockClear();
  transactionMock.mockClear();
});

describe("invalidateKnowledge — entity type scoping", () => {
  it("invalidating 'access' section calls deleteMany with entityType=access", async () => {
    await invalidateKnowledge("prop_1", "access", null);

    const deleteCall = deleteManyMock.mock.calls[0]?.[0];
    expect(deleteCall?.where?.entityType).toBe("access");
    expect(deleteCall?.where?.propertyId).toBe("prop_1");
  });

  it("invalidating 'property' section calls deleteMany with entityType=property", async () => {
    await invalidateKnowledge("prop_1", "property", null);

    const deleteCall = deleteManyMock.mock.calls[0]?.[0];
    expect(deleteCall?.where?.entityType).toBe("property");
  });

  it("invalidating a specific contact uses its entityId", async () => {
    await invalidateKnowledge("prop_1", "contact", "contact_abc");

    const deleteCall = deleteManyMock.mock.calls[0]?.[0];
    expect(deleteCall?.where?.entityType).toBe("contact");
    expect(deleteCall?.where?.entityId).toBe("contact_abc");
  });

  it("invalidating 'amenity' does not call deleteMany for 'contact'", async () => {
    await invalidateKnowledge("prop_1", "amenity", null);

    const deleteCalls = deleteManyMock.mock.calls;
    const contactDelete = deleteCalls.find(
      ([args]) => args?.where?.entityType === "contact",
    );
    expect(contactDelete).toBeUndefined();
  });

  it("runs within a transaction (delete then createMany)", async () => {
    await invalidateKnowledge("prop_1", "property", null);
    // $transaction is called with an array of operations
    expect(transactionMock).toHaveBeenCalled();
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
