import { describe, it, expect, vi } from "vitest";
import {
  getItemForLocale,
  listMissingTranslations,
  getLocaleStatusForProperty,
} from "@/lib/services/knowledge-i18n.service";

// Tests for the fallback policy: requesting a locale without items returns
// the defaultLocale variant annotated with _fallbackFrom.

const esItem = {
  id: "item_es",
  propertyId: "prop_1",
  sourceId: null,
  topic: "Hora de check-in",
  bodyMd: "El check-in es a las 15:00.",
  locale: "es",
  visibility: "guest" as const,
  confidenceScore: 1.0,
  isAutoExtracted: true,
  journeyStage: "pre_arrival",
  lastVerifiedAt: null,
  chunkType: "fact",
  entityType: "property",
  entityId: null,
  canonicalQuestion: null,
  contextPrefix: "",
  bm25Text: "",
  tokens: 10,
  sourceFields: ["checkInStart"],
  tags: [],
  contentHash: "abc123",
  validFrom: null,
  validTo: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const enItem = { ...esItem, id: "item_en", locale: "en", topic: "Check-in time", bodyMd: "Check-in is at 15:00." };

vi.mock("@/lib/db", () => ({
  prisma: {
    knowledgeItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

describe("getItemForLocale", () => {
  it("returns item directly when requested locale exists", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findFirst).mockResolvedValueOnce(enItem as never);

    const result = await getItemForLocale("item_en", "en", "es");
    expect(result?.locale).toBe("en");
    expect((result as { _fallbackFrom?: string })?._fallbackFrom).toBeUndefined();
  });

  it("falls back to defaultLocale and annotates _fallbackFrom when locale missing", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findFirst)
      .mockResolvedValueOnce(null) // fr not found
      .mockResolvedValueOnce(esItem as never); // fallback es found

    const result = await getItemForLocale("item_es", "fr", "es");
    expect(result?.locale).toBe("es");
    expect((result as { _fallbackFrom?: string })?._fallbackFrom).toBe("es");
  });

  it("returns null when neither locale nor fallback has the item", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await getItemForLocale("item_nonexistent", "fr", "es");
    expect(result).toBeNull();
  });

  it("returns null (not infinite loop) when locale === fallbackLocale and item missing", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findFirst).mockResolvedValueOnce(null);

    const result = await getItemForLocale("item_es", "es", "es");
    expect(result).toBeNull();
  });
});

describe("listMissingTranslations", () => {
  it("returns items present in defaultLocale but missing in en", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findMany)
      .mockResolvedValueOnce([
        { entityType: "property", entityId: null, chunkType: "fact", topic: "Check-in time" },
        { entityType: "access", entityId: null, chunkType: "procedure", topic: "Unit access" },
      ] as never)
      .mockResolvedValueOnce([] as never); // no en items

    const missing = await listMissingTranslations("prop_1", "es", ["es", "en"]);
    expect(missing).toHaveLength(2);
    expect(missing.every((m) => m.missingLocales.includes("en"))).toBe(true);
  });

  it("returns empty when all items have en translations", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findMany)
      .mockResolvedValueOnce([
        { entityType: "property", entityId: null, chunkType: "fact", topic: "Check-in time" },
      ] as never)
      .mockResolvedValueOnce([
        { entityType: "property", entityId: null, chunkType: "fact", locale: "en" },
      ] as never);

    const missing = await listMissingTranslations("prop_1", "es", ["es", "en"]);
    expect(missing).toHaveLength(0);
  });

  it("returns empty when targetLocales has only the defaultLocale", async () => {
    const missing = await listMissingTranslations("prop_1", "es", ["es"]);
    expect(missing).toHaveLength(0);
  });
});

describe("getLocaleStatusForProperty", () => {
  it("returns present for locales with items and missing for empty ones", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.groupBy).mockResolvedValueOnce([
      { locale: "es", _count: { id: 12 } },
    ] as never);

    const statuses = await getLocaleStatusForProperty("prop_1", ["es", "en"]);
    const es = statuses.find((s) => s.locale === "es");
    const en = statuses.find((s) => s.locale === "en");
    expect(es?.status).toBe("present");
    expect(es?.count).toBe(12);
    expect(en?.status).toBe("missing");
    expect(en?.count).toBe(0);
  });
});
