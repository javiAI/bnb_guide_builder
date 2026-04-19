import { prisma } from "@/lib/db";
import type { KnowledgeItem } from "@prisma/client";
import { extractFromPropertyAll } from "./knowledge-extract.service";

export const SUPPORTED_LOCALES = ["es", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleStatus {
  locale: string;
  count: number;
  status: "present" | "missing";
}

export interface MissingTranslation {
  entityType: string;
  entityId: string | null;
  chunkType: string;
  topic: string;
  missingLocales: string[];
}

export interface ItemWithFallback extends KnowledgeItem {
  _fallbackFrom?: string;
}

/**
 * Returns the knowledge item in the requested locale.
 * If not found, falls back to `fallbackLocale` and annotates `_fallbackFrom`.
 * Returns null only when neither locale nor fallback has the item.
 */
export async function getItemForLocale(
  itemId: string,
  locale: string,
  fallbackLocale: string,
): Promise<ItemWithFallback | null> {
  const item = await prisma.knowledgeItem.findFirst({
    where: { id: itemId, locale },
  });
  if (item) return item;

  if (locale === fallbackLocale) return null;

  const fallback = await prisma.knowledgeItem.findFirst({
    where: { id: itemId, locale: fallbackLocale },
  });
  if (!fallback) return null;
  return { ...fallback, _fallbackFrom: fallbackLocale };
}

/**
 * Returns locale status summary for a property: how many auto-extracted
 * items exist per locale vs. how many exist in the default locale.
 */
export async function getLocaleStatusForProperty(
  propertyId: string,
  targetLocales: string[],
): Promise<LocaleStatus[]> {
  const counts = await prisma.knowledgeItem.groupBy({
    by: ["locale"],
    where: { propertyId, isAutoExtracted: true },
    _count: { id: true },
  });
  const countByLocale = Object.fromEntries(
    counts.map((r) => [r.locale, r._count.id]),
  );
  return targetLocales.map((locale) => ({
    locale,
    count: countByLocale[locale] ?? 0,
    status: (countByLocale[locale] ?? 0) > 0 ? "present" : "missing",
  }));
}

/**
 * Lists (entityType, entityId, chunkType) tuples that exist in the default
 * locale but are missing in one or more target locales.
 *
 * NOTE: Background invalidation in 11B only re-extracts the defaultLocale.
 * Non-default locale variants (e.g. "en") may become stale after source
 * entity edits until the host manually triggers re-extraction for that locale.
 */
export async function listMissingTranslations(
  propertyId: string,
  defaultLocale: string,
  targetLocales: string[],
): Promise<MissingTranslation[]> {
  const otherLocales = targetLocales.filter((l) => l !== defaultLocale);
  if (otherLocales.length === 0) return [];

  const [defaultItems, otherItems] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where: { propertyId, locale: defaultLocale, isAutoExtracted: true },
      select: { entityType: true, entityId: true, chunkType: true, topic: true },
    }),
    prisma.knowledgeItem.findMany({
      where: {
        propertyId,
        locale: { in: otherLocales },
        isAutoExtracted: true,
      },
      select: { entityType: true, entityId: true, chunkType: true, locale: true },
    }),
  ]);

  const existingKey = new Set(
    otherItems.map((i) => `${i.entityType}|${i.entityId ?? ""}|${i.chunkType}|${i.locale}`),
  );

  const missing: MissingTranslation[] = [];
  for (const item of defaultItems) {
    const missingLocales = otherLocales.filter(
      (l) => !existingKey.has(`${item.entityType}|${item.entityId ?? ""}|${item.chunkType}|${l}`),
    );
    if (missingLocales.length > 0) {
      missing.push({
        entityType: item.entityType,
        entityId: item.entityId,
        chunkType: item.chunkType,
        topic: item.topic,
        missingLocales,
      });
    }
  }
  return missing;
}

/**
 * Extracts all knowledge items for a property in the given locale.
 * Thin wrapper around extractFromPropertyAll with locale param.
 * Scoped delete ensures existing items for other locales are preserved.
 */
export async function extractI18n(
  propertyId: string,
  locale: string,
): Promise<{ count: number }> {
  return extractFromPropertyAll(propertyId, locale);
}
