import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    space: { findMany: vi.fn() },
    property: { findUnique: vi.fn() },
    propertySystem: { findMany: vi.fn() },
    propertyAmenityInstance: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { computeActualCounts, computeSleepingCapacity } from "@/lib/services/property-derived.service";
import { buildPropertyContext } from "@/lib/conditional-engine/context-builder";

const spaceFind = prisma.space.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  spaceFind.mockReset();
});

describe("archived spaces are excluded from reads", () => {
  it("computeActualCounts filters on status=active", async () => {
    spaceFind.mockImplementation(async (args: { where: { status?: string } }) => {
      expect(args.where.status).toBe("active");
      return [
        { spaceType: "sp.bedroom", beds: [{ quantity: 2 }] },
        { spaceType: "sp.bathroom", beds: [] },
      ];
    });

    const counts = await computeActualCounts("prop-1");
    expect(counts.actualBedroomsCount).toBe(1);
    expect(counts.actualBathroomsCount).toBe(1);
    expect(counts.actualBedsCount).toBe(2);
  });

  it("computeSleepingCapacity filters on status=active", async () => {
    spaceFind.mockImplementation(async (args: { where: { status?: string } }) => {
      expect(args.where.status).toBe("active");
      return [
        {
          id: "s1",
          spaceType: "sp.bedroom",
          name: "Dormitorio 1",
          beds: [{ bedType: "bt.double", quantity: 1, configJson: null }],
        },
      ];
    });

    const cap = await computeSleepingCapacity("prop-1");
    expect(cap.bySpace).toHaveLength(1);
    expect(cap.total).toBeGreaterThan(0);
  });

  it("buildPropertyContext filters on status=active", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const fakePrisma = {
      property: {
        findUnique: async () => ({ id: "p", propertyType: "pt.apartment" }),
      },
      space: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          calls.push(args.where);
          return [{ id: "s1", spaceType: "sp.bedroom" }];
        },
      },
      propertySystem: { findMany: async () => [] },
      propertyAmenityInstance: { findMany: async () => [] },
    };
    await buildPropertyContext(fakePrisma, "p");
    expect(calls[0]).toMatchObject({ propertyId: "p", status: "active" });
  });
});

describe("archive action semantics", () => {
  it("archiveSpaceAction updates status instead of deleting", async () => {
    // Contract check: reading src/lib/actions/editor.actions.ts should show
    // prisma.space.update({ data: { status } }), never prisma.space.delete().
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/actions/editor.actions.ts"),
      "utf-8",
    );
    const archiveFn = src.match(/export async function archiveSpaceAction[\s\S]*?^}/m)?.[0] ?? "";
    expect(archiveFn).toContain("space.update");
    expect(archiveFn).not.toContain("space.delete");
    expect(archiveFn).toContain("status");
  });
});
