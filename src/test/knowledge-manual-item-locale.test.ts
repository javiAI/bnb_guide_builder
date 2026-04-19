import { describe, it, expect, vi, beforeEach } from "vitest";
import { createKnowledgeItemAction } from "@/lib/actions/knowledge.actions";

// Manual knowledge items must persist the property's defaultLocale
// explicitly — never fall back to the DB column default "es". If a property
// is configured in "en", a manual item created via the UI must land in "en"
// too, or cross-locale identity (11B) quietly diverges from the host's
// selected language.

const { findUniqueMock, createMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  createMock: vi.fn().mockResolvedValue({ id: "new_item" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUnique: findUniqueMock },
    knowledgeItem: { create: createMock },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  findUniqueMock.mockReset();
  createMock.mockClear();
  createMock.mockResolvedValue({ id: "new_item" });
});

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

const validEntries = {
  propertyId: "prop_1",
  topic: "Cómo funciona el horno",
  bodyMd: "Selector a 180°C, resistencia arriba y abajo.",
  visibility: "guest",
};

describe("createKnowledgeItemAction — locale is server-authoritative", () => {
  it("persists locale='es' when property.defaultLocale='es'", async () => {
    findUniqueMock.mockResolvedValueOnce({ defaultLocale: "es" });

    const result = await createKnowledgeItemAction(null, makeFormData(validEntries));
    expect(result.success).toBe(true);

    expect(createMock).toHaveBeenCalledTimes(1);
    const args = createMock.mock.calls[0][0] as { data: { locale: string } };
    expect(args.data.locale).toBe("es");
  });

  it("persists locale='en' when property.defaultLocale='en' (no silent fallback to 'es')", async () => {
    findUniqueMock.mockResolvedValueOnce({ defaultLocale: "en" });

    const result = await createKnowledgeItemAction(null, makeFormData(validEntries));
    expect(result.success).toBe(true);

    expect(createMock).toHaveBeenCalledTimes(1);
    const args = createMock.mock.calls[0][0] as { data: { locale: string } };
    expect(args.data.locale).toBe("en");
    expect(args.data.locale).not.toBe("es");
  });

  it("reads defaultLocale from DB via propertyId (not from form / client input)", async () => {
    findUniqueMock.mockResolvedValueOnce({ defaultLocale: "en" });

    // Even if a malicious client injects locale='es' in the form, the action
    // must ignore it and use the DB value.
    await createKnowledgeItemAction(
      null,
      makeFormData({ ...validEntries, locale: "es" }),
    );

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "prop_1" },
      select: { defaultLocale: true },
    });
    const args = createMock.mock.calls[0][0] as { data: { locale: string } };
    expect(args.data.locale).toBe("en");
  });

  it("returns friendly error when property not found; does NOT create an item", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const result = await createKnowledgeItemAction(null, makeFormData(validEntries));
    expect(result.success).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("does not look up property when validation fails (fast return)", async () => {
    const result = await createKnowledgeItemAction(
      null,
      makeFormData({ ...validEntries, topic: "" }),
    );
    expect(result.success).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });
});
