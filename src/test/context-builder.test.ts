import { describe, it, expect } from "vitest";
import { buildPropertyContext } from "@/lib/conditional-engine/context-builder";

// Minimal in-memory prisma stub matching the shape buildPropertyContext needs.
function makePrisma(opts: {
  property: Record<string, unknown> | null;
  systems?: string[];
  amenities?: string[];
  spaces?: Array<{ id: string; spaceType: string }>;
}) {
  return {
    property: { findUnique: async () => opts.property },
    space: { findMany: async () => opts.spaces ?? [] },
    propertySystem: { findMany: async () => (opts.systems ?? []).map((systemKey) => ({ systemKey })) },
    propertyAmenityInstance: {
      findMany: async () => (opts.amenities ?? []).map((amenityKey) => ({ amenityKey })),
    },
  };
}

describe("buildPropertyContext", () => {
  it("derives hasElevator from the sys.elevator system (single source, no column)", async () => {
    const withElevator = await buildPropertyContext(
      makePrisma({ property: { id: "p1", propertyType: "pt.apartment" }, systems: ["sys.internet", "sys.elevator"] }),
      "p1",
    );
    expect(withElevator.property.hasElevator).toBe(true);

    const without = await buildPropertyContext(
      makePrisma({ property: { id: "p1", propertyType: "pt.apartment" }, systems: ["sys.internet"] }),
      "p1",
    );
    expect(without.property.hasElevator).toBe(false);
  });

  it("reads buildingFloors from infrastructureJson", async () => {
    const ctx = await buildPropertyContext(
      makePrisma({ property: { id: "p1", infrastructureJson: { buildingFloors: 4 } } }),
      "p1",
    );
    expect(ctx.property.buildingFloors).toBe(4);

    const noInfra = await buildPropertyContext(makePrisma({ property: { id: "p1" } }), "p1");
    expect(noInfra.property.buildingFloors).toBeNull();
  });

  it("exposes propertyEnvironments as an array (multiselect)", async () => {
    const ctx = await buildPropertyContext(
      makePrisma({ property: { id: "p1", propertyEnvironments: ["env.mountain", "env.ski"] } }),
      "p1",
    );
    expect(ctx.property.propertyEnvironments).toEqual(["env.mountain", "env.ski"]);

    const empty = await buildPropertyContext(makePrisma({ property: { id: "p1" } }), "p1");
    expect(empty.property.propertyEnvironments).toEqual([]);
  });

  it("throws when the property is missing", async () => {
    await expect(buildPropertyContext(makePrisma({ property: null }), "ghost")).rejects.toThrow();
  });
});
