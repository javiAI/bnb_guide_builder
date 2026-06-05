import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/db", () => {
  const prismaMock = {
    space: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    property: { findUnique: vi.fn(), update: vi.fn() },
    propertySystem: { findMany: vi.fn() },
    propertyAmenityInstance: { findMany: vi.fn() },
    mediaAssignment: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        space: {
          update: (args: unknown) => prismaMock.space.update(args),
          delete: (args: unknown) => prismaMock.space.delete(args),
          findMany: (args: unknown) => prismaMock.space.findMany(args),
        },
        property: {
          update: (args: unknown) => prismaMock.property.update(args),
        },
        mediaAssignment: {
          deleteMany: (args: unknown) => prismaMock.mediaAssignment.deleteMany(args),
        },
      });
    }),
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/services/property-derived.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/services/property-derived.service")>();
  return { ...original, recomputeAllInBackground: vi.fn() };
});

import { prisma } from "@/lib/db";
import { computeActualCounts, computeSleepingCapacity } from "@/lib/services/property-derived.service";
import { buildPropertyContext } from "@/lib/conditional-engine/context-builder";
import { archiveSpaceAction, deleteSpaceAction } from "@/lib/actions/editor.actions";

const spaceFindMany = prisma.space.findMany as ReturnType<typeof vi.fn>;
const spaceFindUnique = prisma.space.findUnique as ReturnType<typeof vi.fn>;
const spaceUpdate = prisma.space.update as ReturnType<typeof vi.fn>;
const spaceDelete = prisma.space.delete as ReturnType<typeof vi.fn>;
const propertyUpdate = prisma.property.update as ReturnType<typeof vi.fn>;
const mediaDeleteMany = prisma.mediaAssignment.deleteMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  spaceFindMany.mockReset();
  spaceFindUnique.mockReset();
  spaceUpdate.mockReset();
  spaceDelete.mockReset();
  propertyUpdate.mockReset();
  mediaDeleteMany.mockReset();
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

describe("deleteSpaceAction", () => {
  function makeForm(entries: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  }

  it("deletes the space + its polymorphic media assignments and returns success", async () => {
    spaceFindUnique.mockResolvedValue({ propertyId: "prop-1" });
    spaceFindMany.mockResolvedValue([]); // recomputePropertyCounts
    spaceDelete.mockResolvedValue({});
    mediaDeleteMany.mockResolvedValue({ count: 2 });
    propertyUpdate.mockResolvedValue({});

    const result = await deleteSpaceAction(null, makeForm({ spaceId: "s1" }));

    expect(result).toEqual({ success: true });
    expect(spaceDelete).toHaveBeenCalledWith({ where: { id: "s1" } });
    // Polymorphic media links are removed explicitly (no FK cascade).
    expect(mediaDeleteMany).toHaveBeenCalledWith({
      where: { entityType: "space", entityId: "s1" },
    });
  });

  it("returns error when the space does not exist (nothing deleted)", async () => {
    spaceFindUnique.mockResolvedValue(null);
    const result = await deleteSpaceAction(null, makeForm({ spaceId: "missing" }));
    expect(result).toEqual({ success: false, error: "Espacio no encontrado" });
    expect(spaceDelete).not.toHaveBeenCalled();
    expect(mediaDeleteMany).not.toHaveBeenCalled();
  });

  it("returns error when spaceId is missing", async () => {
    const result = await deleteSpaceAction(null, makeForm({}));
    expect(result).toEqual({ success: false, error: "Espacio no encontrado" });
    expect(spaceFindUnique).not.toHaveBeenCalled();
  });
});
