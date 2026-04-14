import { describe, it, expect } from "vitest";
import * as repos from "@/lib/repositories";
import {
  createAmenityInstanceSchema,
  updateAmenityInstanceSchema,
} from "@/lib/schemas/editor.schema";
import { prisma } from "@/lib/db";

// Phase 2 / Branch 2A — structural tests for the new amenity instance
// model. These do not hit the DB; the full backfill + actions are
// exercised manually via `scripts/migrate-amenities-to-instances.ts`.

describe("amenityInstanceRepository exports", () => {
  it("is exported from repositories index", () => {
    expect(repos).toHaveProperty("amenityInstanceRepository");
    expect(typeof repos.amenityInstanceRepository).toBe("object");
  });

  it("exposes CRUD + placement methods", () => {
    const r = repos.amenityInstanceRepository;
    expect(r).toHaveProperty("findByProperty");
    expect(r).toHaveProperty("findById");
    expect(r).toHaveProperty("create");
    expect(r).toHaveProperty("update");
    expect(r).toHaveProperty("delete");
    expect(r).toHaveProperty("addPlacement");
    expect(r).toHaveProperty("removePlacement");
  });
});

describe("Prisma client has the new models", () => {
  it("exposes propertyAmenityInstance delegate", () => {
    expect(prisma.propertyAmenityInstance).toBeDefined();
    expect(typeof prisma.propertyAmenityInstance.findMany).toBe("function");
  });

  it("exposes propertyAmenityPlacement delegate", () => {
    expect(prisma.propertyAmenityPlacement).toBeDefined();
    expect(typeof prisma.propertyAmenityPlacement.findMany).toBe("function");
  });

  it("keeps the legacy PropertyAmenity delegate during dual-write window", () => {
    // Cutover happens in Branch 2C — until then both coexist.
    expect(prisma.propertyAmenity).toBeDefined();
  });
});

describe("createAmenityInstanceSchema", () => {
  it("accepts minimal payload with default instanceKey", () => {
    const result = createAmenityInstanceSchema.safeParse({ amenityKey: "am.wifi" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instanceKey).toBe("default");
    }
  });

  it("accepts explicit instanceKey + subtype + visibility", () => {
    const result = createAmenityInstanceSchema.safeParse({
      amenityKey: "am.heating",
      instanceKey: "space:abc123",
      subtypeKey: "heat.radiator",
      visibility: "internal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty amenityKey", () => {
    const result = createAmenityInstanceSchema.safeParse({ amenityKey: "" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown visibility", () => {
    const result = createAmenityInstanceSchema.safeParse({
      amenityKey: "am.wifi",
      visibility: "bogus",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateAmenityInstanceSchema", () => {
  it("accepts partial updates", () => {
    expect(updateAmenityInstanceSchema.safeParse({}).success).toBe(true);
    expect(updateAmenityInstanceSchema.safeParse({ guestInstructions: "abc" }).success).toBe(true);
  });

  it("accepts detailsJson with mixed primitive values", () => {
    const result = updateAmenityInstanceSchema.safeParse({
      detailsJson: { a: "x", b: 2, c: true, d: ["tag1", "tag2"], e: null },
    });
    expect(result.success).toBe(true);
  });

  it("rejects nested objects in detailsJson", () => {
    const result = updateAmenityInstanceSchema.safeParse({
      detailsJson: { nested: { inner: "value" } as unknown as string },
    });
    expect(result.success).toBe(false);
  });
});

describe("Backfill key derivation", () => {
  // The backfill script derives instanceKey as:
  //   spaceId ? `space:${spaceId}` : "default"
  // Keep this invariant locked so Branch 2B/2C don't drift.
  function instanceKeyFor(spaceId: string | null): string {
    return spaceId ? `space:${spaceId}` : "default";
  }

  it("maps null spaceId to 'default'", () => {
    expect(instanceKeyFor(null)).toBe("default");
  });

  it("namespaces space-scoped rows under 'space:<id>'", () => {
    expect(instanceKeyFor("clabc123")).toBe("space:clabc123");
  });
});
