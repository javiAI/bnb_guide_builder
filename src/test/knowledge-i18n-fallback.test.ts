import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getItemForLocale,
  isSupportedLocale,
  listMissingTranslations,
  getLocaleStatusForProperty,
} from "@/lib/services/knowledge-i18n.service";

// Cross-locale identity semantics: chunks are paired across locales by
// (propertyId, entityType, entityId, templateKey), not by row id.

const baseIdentity = {
  propertyId: "prop_1",
  entityType: "property",
  entityId: null,
  templateKey: "checkin_time",
};

const esItem = {
  id: "item_es_checkin",
  ...baseIdentity,
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

const enItem = {
  ...esItem,
  id: "item_en_checkin",
  locale: "en",
  topic: "Check-in time",
  bodyMd: "Check-in is at 15:00.",
};

vi.mock("@/lib/db", () => ({
  prisma: {
    knowledgeItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

beforeEach(async () => {
  const { prisma } = await import("@/lib/db");
  vi.mocked(prisma.knowledgeItem.findUnique).mockReset();
  vi.mocked(prisma.knowledgeItem.findFirst).mockReset();
  vi.mocked(prisma.knowledgeItem.findMany).mockReset();
  vi.mocked(prisma.knowledgeItem.groupBy).mockReset();
});

describe("isSupportedLocale", () => {
  it("accepts es and en", () => {
    expect(isSupportedLocale("es")).toBe(true);
    expect(isSupportedLocale("en")).toBe(true);
  });
  it("rejects other strings and non-strings", () => {
    expect(isSupportedLocale("fr")).toBe(false);
    expect(isSupportedLocale("")).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});

describe("getItemForLocale", () => {
  it("returns source directly when source.locale matches requested locale", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findUnique).mockResolvedValueOnce(enItem as never);

    const result = await getItemForLocale("item_en_checkin", "en", "es");
    expect(result?.id).toBe("item_en_checkin");
    expect(result?.locale).toBe("en");
    expect((result as { _fallbackFrom?: string })?._fallbackFrom).toBeUndefined();
  });

  it("resolves cross-locale sibling by (entityType, entityId, templateKey) with different row id", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findUnique).mockResolvedValueOnce(esItem as never);
    vi.mocked(prisma.knowledgeItem.findFirst).mockResolvedValueOnce(enItem as never);

    const result = await getItemForLocale("item_es_checkin", "en", "es");
    expect(result?.id).toBe("item_en_checkin");
    expect(result?.locale).toBe("en");
    expect((result as { _fallbackFrom?: string })?._fallbackFrom).toBeUndefined();

    const firstCall = vi.mocked(prisma.knowledgeItem.findFirst).mock.calls[0][0];
    expect(firstCall?.where).toMatchObject({
      propertyId: "prop_1",
      entityType: "property",
      entityId: null,
      templateKey: "checkin_time",
      locale: "en",
    });
  });

  it("returns null for manual items (templateKey=null) when requested locale differs", async () => {
    const manual = { ...esItem, id: "manual_1", templateKey: null, isAutoExtracted: false };
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findUnique).mockResolvedValueOnce(manual as never);

    const result = await getItemForLocale("manual_1", "en", "es");
    expect(result).toBeNull();
    // No cross-locale lookup performed for manual items.
    expect(prisma.knowledgeItem.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to defaultLocale sibling and annotates _fallbackFrom", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findUnique).mockResolvedValueOnce(enItem as never);
    vi.mocked(prisma.knowledgeItem.findFirst)
      .mockResolvedValueOnce(null) // fr sibling not found
      .mockResolvedValueOnce(esItem as never); // es (fallback) sibling found

    const result = await getItemForLocale("item_en_checkin", "fr", "es");
    expect(result?.id).toBe("item_es_checkin");
    expect(result?.locale).toBe("es");
    expect((result as { _fallbackFrom?: string })?._fallbackFrom).toBe("es");
  });

  it("returns source annotated with _fallbackFrom when source is already defaultLocale and requested locale missing", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findUnique).mockResolvedValueOnce(esItem as never);
    vi.mocked(prisma.knowledgeItem.findFirst).mockResolvedValueOnce(null); // no fr sibling

    const result = await getItemForLocale("item_es_checkin", "fr", "es");
    expect(result?.id).toBe("item_es_checkin");
    expect((result as { _fallbackFrom?: string })?._fallbackFrom).toBe("es");
  });

  it("returns null when requested locale === fallbackLocale and item missing", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findUnique).mockResolvedValueOnce(null);

    const result = await getItemForLocale("item_missing", "es", "es");
    expect(result).toBeNull();
  });

  it("returns null when source not found", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findUnique).mockResolvedValueOnce(null);

    const result = await getItemForLocale("item_missing", "en", "es");
    expect(result).toBeNull();
    expect(prisma.knowledgeItem.findFirst).not.toHaveBeenCalled();
  });
});

describe("listMissingTranslations — identity by templateKey", () => {
  it("does NOT collapse multiple property/fact chunks with different templateKeys", async () => {
    const { prisma } = await import("@/lib/db");
    // Four property/fact chunks in es, none translated to en.
    vi.mocked(prisma.knowledgeItem.findMany)
      .mockResolvedValueOnce([
        { entityType: "property", entityId: null, templateKey: "checkin_time", chunkType: "fact", topic: "Hora de check-in" },
        { entityType: "property", entityId: null, templateKey: "checkout_time", chunkType: "fact", topic: "Hora de check-out" },
        { entityType: "property", entityId: null, templateKey: "capacity", chunkType: "fact", topic: "Capacidad" },
        { entityType: "property", entityId: null, templateKey: "location", chunkType: "fact", topic: "Ubicación" },
      ] as never)
      .mockResolvedValueOnce([] as never); // no en items

    const missing = await listMissingTranslations("prop_1", "es", ["es", "en"]);
    expect(missing).toHaveLength(4);
    const keys = missing.map((m) => m.templateKey).sort();
    expect(keys).toEqual(["capacity", "checkin_time", "checkout_time", "location"]);
    expect(missing.every((m) => m.missingLocales.includes("en"))).toBe(true);
  });

  it("excludes items already translated (same templateKey present in target locale)", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeItem.findMany)
      .mockResolvedValueOnce([
        { entityType: "property", entityId: null, templateKey: "checkin_time", chunkType: "fact", topic: "Hora de check-in" },
        { entityType: "property", entityId: null, templateKey: "checkout_time", chunkType: "fact", topic: "Hora de check-out" },
      ] as never)
      .mockResolvedValueOnce([
        { entityType: "property", entityId: null, templateKey: "checkin_time", locale: "en" },
      ] as never);

    const missing = await listMissingTranslations("prop_1", "es", ["es", "en"]);
    expect(missing).toHaveLength(1);
    expect(missing[0].templateKey).toBe("checkout_time");
  });

  it("excludes manual items (templateKey=null) — they do not participate in cross-locale tracking", async () => {
    const { prisma } = await import("@/lib/db");
    // The query filters templateKey: { not: null } upstream; assert the filter
    // is wired into the findMany call so manual items never reach the result.
    vi.mocked(prisma.knowledgeItem.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    await listMissingTranslations("prop_1", "es", ["es", "en"]);

    const calls = vi.mocked(prisma.knowledgeItem.findMany).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [args] of calls) {
      const where = (args as { where: Record<string, unknown> }).where;
      expect(where.templateKey).toEqual({ not: null });
    }
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
