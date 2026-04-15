import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    space: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    property: { findUnique: vi.fn(), update: vi.fn() },
    propertySystem: { findMany: vi.fn() },
    propertyAmenityInstance: { findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        space: {
          update: (args: unknown) => (prisma.space.update as ReturnType<typeof vi.fn>)(args),
          delete: (args: unknown) => (prisma.space.delete as ReturnType<typeof vi.fn>)(args),
          findMany: (args: unknown) => (prisma.space.findMany as ReturnType<typeof vi.fn>)(args),
        },
        property: {
          update: (args: unknown) => (prisma.property.update as ReturnType<typeof vi.fn>)(args),
        },
      });
    }),
  },
}));

vi.mock("@/lib/services/property-derived.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/services/property-derived.service")>();
  return { ...original, recomputeAllInBackground: vi.fn() };
});

import { prisma } from "@/lib/db";
import { computeActualCounts, computeSleepingCapacity } from "@/lib/services/property-derived.service";
import { buildPropertyContext } from "@/lib/conditional-engine/context-builder";
import { archiveSpaceAction } from "@/lib/actions/editor.actions";

const spaceFindMany = prisma.space.findMany as ReturnType<typeof vi.fn>;
const spaceFindUnique = prisma.space.findUnique as ReturnType<typeof vi.fn>;
const spaceUpdate = prisma.space.update as ReturnType<typeof vi.fn>;
const spaceDelete = prisma.space.delete as ReturnType<typeof vi.fn>;
const propertyUpdate = prisma.property.update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  spaceFindMany.mockReset();
  spaceFindUnique.mockReset();
  spaceUpdate.mockReset();
  spaceDelete.mockReset();
  propertyUpdate.mockReset();
});

describe("archived spaces are excluded from reads", () => {
  it("computeActualCounts filters on status=active", async () => {
    spaceFindMany.mockImplementation(async (args: { where: { status?: string } }) => {
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
    spaceFindMany.mockImplementation(async (args: { where: { status?: string } }) => {
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

describe("archiveSpaceAction", () => {
  function makeForm(entries: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  }

  it("updates status to archived and never deletes", async () => {
    spaceFindUnique.mockResolvedValue({ propertyId: "prop-1" });
    spaceFindMany.mockResolvedValue([]); // recomputePropertyCounts
    spaceUpdate.mockResolvedValue({});
    propertyUpdate.mockResolvedValue({});

    const result = await archiveSpaceAction(null, makeForm({ spaceId: "s1", status: "archived" }));

    expect(result).toEqual({ success: true });
    expect(spaceUpdate).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "archived" },
    });
    expect(spaceDelete).not.toHaveBeenCalled();
  });

  it("restores by updating status back to active", async () => {
    spaceFindUnique.mockResolvedValue({ propertyId: "prop-1" });
    spaceFindMany.mockResolvedValue([]);
    spaceUpdate.mockResolvedValue({});
    propertyUpdate.mockResolvedValue({});

    const result = await archiveSpaceAction(null, makeForm({ spaceId: "s1", status: "active" }));

    expect(result).toEqual({ success: true });
    expect(spaceUpdate).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "active" },
    });
  });

  it("rejects invalid status values without touching the DB", async () => {
    const result = await archiveSpaceAction(null, makeForm({ spaceId: "s1", status: "bogus" }));
    expect(result).toEqual({ success: false, error: "Estado inválido" });
    expect(spaceFindUnique).not.toHaveBeenCalled();
    expect(spaceUpdate).not.toHaveBeenCalled();
  });

  it("returns error when space does not exist", async () => {
    spaceFindUnique.mockResolvedValue(null);
    const result = await archiveSpaceAction(null, makeForm({ spaceId: "missing", status: "archived" }));
    expect(result).toEqual({ success: false, error: "Espacio no encontrado" });
    expect(spaceUpdate).not.toHaveBeenCalled();
  });
});
