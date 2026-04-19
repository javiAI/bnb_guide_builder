import { prisma } from "@/lib/db";
import type { KnowledgeItem } from "@prisma/client";
import { extractFromPropertyAll } from "./knowledge-extract.service";

export const SUPPORTED_LOCALES = ["es", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export interface LocaleStatus {
  locale: string;
  count: number;
  status: "present" | "missing";
}

export interface MissingTranslation {
  entityType: string;
  entityId: string | null;
  templateKey: string;
  chunkType: string;
  topic: string;
  missingLocales: string[];
}

export interface ItemWithFallback extends KnowledgeItem {
  _fallbackFrom?: string;
}

// Cross-locale chunk identity: (propertyId, entityType, entityId, templateKey)
//
// Semantics:
//   1. Load source item by id.
//   2. If source.locale === requested locale, return as-is.
//   3. If templateKey is null (manual item), cross-locale lookup is not
//      defined — manual items do not have a stable identity shared with
//      their (hypothetical) translations. Return null.
//   4. Look up sibling with the same identity in the requested locale.
//   5. Fall back to fallbackLocale with the same identity; annotate
//      `_fallbackFrom` so callers can surface the stale/fallback state.
export async function getItemForLocale(
  itemId: string,
  locale: string,
  fallbackLocale: string,
): Promise<ItemWithFallback | null> {
  const source = await prisma.knowledgeItem.findUnique({ where: { id: itemId } });
  if (!source) return null;

  if (source.locale === locale) return source;

  if (!source.templateKey) return null;

  const identity = {
    propertyId: source.propertyId,
    entityType: source.entityType,
    entityId: source.entityId,
    templateKey: source.templateKey,
  };

  const match = await prisma.knowledgeItem.findFirst({
    where: { ...identity, locale },
  });
  if (match) return match;

  if (locale === fallbackLocale) return null;

  if (source.locale === fallbackLocale) {
    return { ...source, _fallbackFrom: fallbackLocale };
  }

  const fallback = await prisma.knowledgeItem.findFirst({
    where: { ...identity, locale: fallbackLocale },
  });
  if (!fallback) return null;
  return { ...fallback, _fallbackFrom: fallbackLocale };
}

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

// Lists auto-extracted chunks from the default locale that do not have a
// sibling with the same `(entityType, entityId, templateKey)` identity in
// each target locale. Manual items (templateKey=null) are excluded — they
// do not participate in cross-locale translation tracking.
//
// Background invalidation only re-extracts the defaultLocale; non-default
// variants may go stale until the host triggers locale-scoped re-extraction.
export async function listMissingTranslations(
  propertyId: string,
  defaultLocale: string,
  targetLocales: string[],
): Promise<MissingTranslation[]> {
  const otherLocales = targetLocales.filter((l) => l !== defaultLocale);
  if (otherLocales.length === 0) return [];

  const [defaultItems, otherItems] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where: {
        propertyId,
        locale: defaultLocale,
        isAutoExtracted: true,
        templateKey: { not: null },
      },
      select: {
        entityType: true,
        entityId: true,
        templateKey: true,
        chunkType: true,
        topic: true,
      },
    }),
    prisma.knowledgeItem.findMany({
      where: {
        propertyId,
        locale: { in: otherLocales },
        isAutoExtracted: true,
        templateKey: { not: null },
      },
      select: {
        entityType: true,
        entityId: true,
        templateKey: true,
        locale: true,
      },
    }),
  ]);

  const identityKey = (
    entityType: string,
    entityId: string | null,
    templateKey: string,
    locale: string,
  ) => `${entityType}|${entityId ?? ""}|${templateKey}|${locale}`;

  const existingKey = new Set(
    otherItems.map((i) =>
      identityKey(i.entityType, i.entityId, i.templateKey!, i.locale),
    ),
  );

  const missing: MissingTranslation[] = [];
  for (const item of defaultItems) {
    const missingLocales = otherLocales.filter(
      (l) => !existingKey.has(identityKey(item.entityType, item.entityId, item.templateKey!, l)),
    );
    if (missingLocales.length > 0) {
      missing.push({
        entityType: item.entityType,
        entityId: item.entityId,
        templateKey: item.templateKey!,
        chunkType: item.chunkType,
        topic: item.topic,
        missingLocales,
      });
    }
  }
  return missing;
}

export async function extractI18n(
  propertyId: string,
  locale: string,
): Promise<{ count: number }> {
  return extractFromPropertyAll(propertyId, locale);
}
