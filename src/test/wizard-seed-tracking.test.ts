import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/db", () => {
  const prismaMock = {
    space: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    bedConfiguration: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    property: {
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        space: {
          update: (args: unknown) => prismaMock.space.update(args),
          findMany: (args: unknown) => prismaMock.space.findMany(args),
        },
        bedConfiguration: {
          update: (args: unknown) => prismaMock.bedConfiguration.update(args),
          delete: (args: unknown) => prismaMock.bedConfiguration.delete(args),
          create: (args: unknown) => prismaMock.bedConfiguration.create(args),
          findFirst: (args: unknown) => prismaMock.bedConfiguration.findFirst(args),
        },
        property: {
          update: (args: unknown) => prismaMock.property.update(args),
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
import {
  renameSpaceAction,
  updateSpaceAction,
  updateSpaceDetailsAction,
  addBedAction,
  updateBedAction,
  deleteBedAction,
  updateBedConfigAction,
} from "@/lib/actions/editor.actions";

const spaceFindUnique = prisma.space.findUnique as ReturnType<typeof vi.fn>;
const spaceUpdate = prisma.space.update as ReturnType<typeof vi.fn>;
const bedFindUnique = prisma.bedConfiguration.findUnique as ReturnType<typeof vi.fn>;
const bedFindFirst = prisma.bedConfiguration.findFirst as ReturnType<typeof vi.fn>;
const bedUpdate = prisma.bedConfiguration.update as ReturnType<typeof vi.fn>;
const bedDelete = prisma.bedConfiguration.delete as ReturnType<typeof vi.fn>;
const bedCreate = prisma.bedConfiguration.create as ReturnType<typeof vi.fn>;

beforeEach(() => {
  spaceFindUnique.mockReset();
  spaceUpdate.mockReset().mockResolvedValue({});
  bedFindUnique.mockReset();
  bedFindFirst.mockReset();
  bedUpdate.mockReset().mockResolvedValue({});
  bedDelete.mockReset().mockResolvedValue({});
  bedCreate.mockReset().mockResolvedValue({});
});

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("wizard seed tracking — manual edits transfer ownership", () => {
  it("updateSpaceAction clears wizardSeedKey and promotes to user (visibility edit)", async () => {
    spaceFindUnique.mockResolvedValue({ propertyId: "p1" });
    await updateSpaceAction(
      null,
      form({
        spaceId: "s1",
        propertyId: "p1",
        name: "Dormitorio 1",
        visibility: "internal",
      }),
    );
    const call = spaceUpdate.mock.calls[0][0];
    expect(call).toMatchObject({
      where: { id: "s1" },
      data: expect.objectContaining({ createdBy: "user", wizardSeedKey: null }),
    });
  });

  it("renameSpaceAction clears wizardSeedKey and promotes to user", async () => {
    spaceFindUnique.mockResolvedValue({ propertyId: "p1" });
    await renameSpaceAction(null, form({ spaceId: "s1", name: "Habitación principal" }));
    expect(spaceUpdate).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { name: "Habitación principal", createdBy: "user", wizardSeedKey: null },
    });
  });

  it("updateSpaceDetailsAction clears wizardSeedKey", async () => {
    spaceFindUnique.mockResolvedValue({ propertyId: "p1" });
    await updateSpaceDetailsAction(
      null,
      form({ spaceId: "s1", guestNotes: "Vista al mar", internalNotes: "" }),
    );
    const call = spaceUpdate.mock.calls[0][0];
    expect(call.data).toMatchObject({ createdBy: "user", wizardSeedKey: null });
  });

  it("addBedAction increments existing bed, clears its seedKey, and promotes parent space", async () => {
    spaceFindUnique.mockResolvedValue({ propertyId: "p1" });
    bedFindFirst.mockResolvedValue({ id: "b1", quantity: 1 });

    await addBedAction(
      null,
      form({ spaceId: "s1", bedType: "bt.queen", quantity: "1" }),
    );

    expect(bedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1" },
        data: expect.objectContaining({ quantity: 2, wizardSeedKey: null }),
      }),
    );
    const spaceCall = spaceUpdate.mock.calls.find((c) => c[0].where.id === "s1");
    expect(spaceCall?.[0].data).toMatchObject({ createdBy: "user", wizardSeedKey: null });
  });

  it("updateBedAction clears seedKey on bed and promotes parent space", async () => {
    bedFindUnique.mockResolvedValue({
      spaceId: "s1",
      space: { propertyId: "p1" },
    });

    await updateBedAction(
      null,
      form({ bedId: "b1", spaceId: "s1", bedType: "bt.queen", quantity: "1" }),
    );

    const bedCall = bedUpdate.mock.calls[0][0];
    expect(bedCall).toMatchObject({
      where: { id: "b1" },
      data: { wizardSeedKey: null },
    });

    const spaceCall = spaceUpdate.mock.calls.find((c) => c[0].where.id === "s1");
    expect(spaceCall?.[0].data).toMatchObject({ createdBy: "user", wizardSeedKey: null });
  });

  it("deleteBedAction promotes parent space to user", async () => {
    bedFindUnique.mockResolvedValue({
      spaceId: "s1",
      space: { propertyId: "p1" },
    });

    await deleteBedAction(null, form({ bedId: "b1", spaceId: "s1" }));

    expect(bedDelete).toHaveBeenCalledWith({ where: { id: "b1" } });
    const spaceCall = spaceUpdate.mock.calls.find((c) => c[0].where.id === "s1");
    expect(spaceCall?.[0].data).toMatchObject({ createdBy: "user", wizardSeedKey: null });
  });

  it("updateBedConfigAction clears seedKey on bed and space", async () => {
    bedFindUnique.mockResolvedValue({
      spaceId: "s1",
      space: { propertyId: "p1" },
    });

    await updateBedConfigAction(null, form({ bedId: "b1", spaceId: "s1" }));

    expect(bedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ wizardSeedKey: null }) }),
    );
    const spaceCall = spaceUpdate.mock.calls.find((c) => c[0].where.id === "s1");
    expect(spaceCall?.[0].data).toMatchObject({ createdBy: "user", wizardSeedKey: null });
  });
});

describe("wizard seed tracking — schema", () => {
  it("Space has createdBy + wizardSeedKey fields with unique scope", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf-8");
    const spaceModel = src.match(/model Space \{[\s\S]*?^\}/m)?.[0] ?? "";
    expect(spaceModel).toMatch(/createdBy\s+String\s+@default\("user"\)/);
    expect(spaceModel).toMatch(/wizardSeedKey\s+String\?/);
    expect(spaceModel).toMatch(/@@unique\(\[\s*propertyId\s*,\s*wizardSeedKey\s*\]\)/);

    const bedModel = src.match(/model BedConfiguration \{[\s\S]*?^\}/m)?.[0] ?? "";
    expect(bedModel).toMatch(/wizardSeedKey\s+String\?/);
    expect(bedModel).toMatch(/@@unique\(\[\s*spaceId\s*,\s*wizardSeedKey\s*\]\)/);
  });
});
