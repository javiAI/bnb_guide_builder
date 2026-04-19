import { describe, it, expect, vi, beforeEach } from "vitest";
import { regenerateLocaleAction } from "@/lib/actions/knowledge.actions";

// Locale validation: the action must refuse unsupported locales with a
// friendly error rather than invoke the extractor. Protects against
// ?locale=fr reaching extractFromPropertyAll.

const { extractSpy } = vi.hoisted(() => ({
  extractSpy: vi.fn().mockResolvedValue({ count: 0 }),
}));

vi.mock("@/lib/services/knowledge-extract.service", () => ({
  extractFromPropertyAll: extractSpy,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

beforeEach(() => {
  extractSpy.mockClear();
});

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

describe("regenerateLocaleAction — locale validation", () => {
  it("accepts supported locale 'es'", async () => {
    const result = await regenerateLocaleAction(
      null,
      makeFormData({ propertyId: "p1", locale: "es" }),
    );
    expect(result.success).toBe(true);
    expect(extractSpy).toHaveBeenCalledWith("p1", "es");
  });

  it("accepts supported locale 'en'", async () => {
    const result = await regenerateLocaleAction(
      null,
      makeFormData({ propertyId: "p1", locale: "en" }),
    );
    expect(result.success).toBe(true);
    expect(extractSpy).toHaveBeenCalledWith("p1", "en");
  });

  it("rejects unsupported locale 'fr' with friendly error and does NOT call extractor", async () => {
    const result = await regenerateLocaleAction(
      null,
      makeFormData({ propertyId: "p1", locale: "fr" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/no soportado/i);
      expect(result.error).toContain("fr");
    }
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it("rejects empty locale", async () => {
    const result = await regenerateLocaleAction(
      null,
      makeFormData({ propertyId: "p1", locale: "" }),
    );
    expect(result.success).toBe(false);
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it("rejects missing propertyId", async () => {
    const result = await regenerateLocaleAction(
      null,
      makeFormData({ propertyId: "", locale: "en" }),
    );
    expect(result.success).toBe(false);
    expect(extractSpy).not.toHaveBeenCalled();
  });
});
