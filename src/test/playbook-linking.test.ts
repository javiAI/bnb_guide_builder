import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/db", () => {
  const prismaMock = {
    troubleshootingPlaybook: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    space: {
      findUnique: vi.fn(),
    },
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/db";
import { updatePlaybookAction } from "@/lib/actions/editor.actions";

const playbookFindUnique = prisma.troubleshootingPlaybook.findUnique as ReturnType<typeof vi.fn>;
const playbookUpdate = prisma.troubleshootingPlaybook.update as ReturnType<typeof vi.fn>;
const spaceFindUnique = prisma.space.findUnique as ReturnType<typeof vi.fn>;

beforeEach(() => {
  playbookFindUnique.mockReset();
  playbookUpdate.mockReset().mockResolvedValue({});
  spaceFindUnique.mockReset();
});

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("playbook target linking", () => {
  it("links to a system by setting systemKey and clearing other targets", async () => {
    playbookFindUnique.mockResolvedValue({ propertyId: "p1" });
    const res = await updatePlaybookAction(
      null,
      form({
        playbookId: "pb1",
        propertyId: "p1",
        title: "Wifi caído",
        targetType: "system",
        targetKey: "sys.internet",
      }),
    );
    expect(res).toEqual({ success: true });
    const call = playbookUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: "pb1" });
    expect(call.data).toMatchObject({
      systemKey: "sys.internet",
      amenityKey: null,
      spaceId: null,
      accessMethodKey: null,
    });
  });

  it("links to an amenity", async () => {
    playbookFindUnique.mockResolvedValue({ propertyId: "p1" });
    await updatePlaybookAction(
      null,
      form({
        playbookId: "pb1",
        propertyId: "p1",
        title: "Lavavajillas atascado",
        targetType: "amenity",
        targetKey: "amen.dishwasher",
      }),
    );
    const call = playbookUpdate.mock.calls[0][0];
    expect(call.data).toMatchObject({
      amenityKey: "amen.dishwasher",
      systemKey: null,
      spaceId: null,
      accessMethodKey: null,
    });
  });

  it("links to a space and validates ownership", async () => {
    playbookFindUnique.mockResolvedValue({ propertyId: "p1" });
    spaceFindUnique.mockResolvedValue({ propertyId: "p1" });
    const res = await updatePlaybookAction(
      null,
      form({
        playbookId: "pb1",
        propertyId: "p1",
        title: "Cocina",
        targetType: "space",
        targetKey: "s1",
      }),
    );
    expect(res).toEqual({ success: true });
    const call = playbookUpdate.mock.calls[0][0];
    expect(call.data).toMatchObject({ spaceId: "s1" });
  });

  it("rejects space link from a different property", async () => {
    playbookFindUnique.mockResolvedValue({ propertyId: "p1" });
    spaceFindUnique.mockResolvedValue({ propertyId: "other" });
    const res = await updatePlaybookAction(
      null,
      form({
        playbookId: "pb1",
        propertyId: "p1",
        title: "Cocina",
        targetType: "space",
        targetKey: "s1",
      }),
    );
    expect(res).toEqual({ success: false, error: "El espacio no pertenece a la propiedad" });
    expect(playbookUpdate).not.toHaveBeenCalled();
  });

  it("links to an access method", async () => {
    playbookFindUnique.mockResolvedValue({ propertyId: "p1" });
    await updatePlaybookAction(
      null,
      form({
        playbookId: "pb1",
        propertyId: "p1",
        title: "Cerradura",
        targetType: "access",
        targetKey: "access.keypad",
      }),
    );
    const call = playbookUpdate.mock.calls[0][0];
    expect(call.data).toMatchObject({
      accessMethodKey: "access.keypad",
      systemKey: null,
      amenityKey: null,
      spaceId: null,
    });
  });

  it("clears all target fields when targetType=none", async () => {
    playbookFindUnique.mockResolvedValue({ propertyId: "p1" });
    await updatePlaybookAction(
      null,
      form({
        playbookId: "pb1",
        propertyId: "p1",
        title: "Genérico",
        targetType: "none",
      }),
    );
    const call = playbookUpdate.mock.calls[0][0];
    expect(call.data).toMatchObject({
      systemKey: null,
      amenityKey: null,
      spaceId: null,
      accessMethodKey: null,
    });
  });

  it("rejects targetType with empty targetKey", async () => {
    playbookFindUnique.mockResolvedValue({ propertyId: "p1" });
    const res = await updatePlaybookAction(
      null,
      form({
        playbookId: "pb1",
        propertyId: "p1",
        title: "Sin target",
        targetType: "system",
        targetKey: "",
      }),
    );
    expect(res.success).toBe(false);
    expect(playbookUpdate).not.toHaveBeenCalled();
  });
});

describe("playbook linking — schema", () => {
  it("TroubleshootingPlaybook has 4 target fields + Space relation", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf-8");
    const model = src.match(/model TroubleshootingPlaybook \{[\s\S]*?^\}/m)?.[0] ?? "";
    expect(model).toMatch(/systemKey\s+String\?/);
    expect(model).toMatch(/amenityKey\s+String\?/);
    expect(model).toMatch(/spaceId\s+String\?/);
    expect(model).toMatch(/accessMethodKey\s+String\?/);
    expect(model).toMatch(/space\s+Space\?\s+@relation/);
  });
});
