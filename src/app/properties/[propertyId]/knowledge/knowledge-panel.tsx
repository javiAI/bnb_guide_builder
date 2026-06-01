import { prisma } from "@/lib/db";
import { CreateKnowledgeItemForm } from "./create-knowledge-form";
import { KnowledgeItemCard } from "./knowledge-item-card";
import { RegenerateKnowledgeButton } from "./regenerate-knowledge-button";
import { LocaleSwitcherClient } from "./locale-switcher";
import { VISIBILITY_LABEL, VISIBILITY_TONE } from "@/lib/visibility";
import {
  SUPPORTED_LOCALES,
  getLocaleStatusForProperty,
  isSupportedLocale,
  listMissingTranslations,
} from "@/lib/services/knowledge-i18n.service";

const JOURNEY_LABEL: Record<string, string> = {
  pre_booking: "Pre-reserva",
  post_booking: "Post-reserva",
  pre_arrival: "Pre-llegada",
  during_stay: "Durante estancia",
  post_stay: "Post-estancia",
  arrival: "Llegada",
  stay: "Estancia",
  checkout: "Salida",
  post_checkout: "Post-salida",
  any: "Cualquier etapa",
};

/**
 * Knowledge-base management body (Liora 16F.5). Extracted from the standalone
 * `/knowledge` page so it can live inside the unified `/ai` (Asistente IA) page
 * alongside the chat — the knowledge is no longer buried. The locale switcher
 * uses `usePathname()`, so it works on whatever route hosts this panel.
 */
export async function KnowledgePanel({
  propertyId,
  defaultLocale,
  localeParam,
}: {
  propertyId: string;
  defaultLocale: string;
  localeParam?: string;
}) {
  const activeLocale = isSupportedLocale(localeParam) ? localeParam : defaultLocale;

  const [items, localeStatuses] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where: { propertyId, locale: activeLocale },
      orderBy: [{ entityType: "asc" }, { topic: "asc" }],
      select: {
        id: true,
        topic: true,
        bodyMd: true,
        visibility: true,
        journeyStage: true,
        confidenceScore: true,
        lastVerifiedAt: true,
        chunkType: true,
        entityType: true,
        contextPrefix: true,
      },
    }),
    getLocaleStatusForProperty(propertyId, [...SUPPORTED_LOCALES]),
  ]);

  // The "missing translations" warning + the regenerate control only render on
  // the default locale, so skip the (multi-query) check on other locales.
  const missingTranslations =
    activeLocale === defaultLocale
      ? await listMissingTranslations(propertyId, defaultLocale, [...SUPPORTED_LOCALES])
      : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">Idioma:</span>
          <LocaleSwitcherClient
            propertyId={propertyId}
            defaultLocale={defaultLocale}
            activeLocale={activeLocale}
            localeStatuses={localeStatuses}
          />
        </div>
        {activeLocale === defaultLocale && <RegenerateKnowledgeButton propertyId={propertyId} />}
      </div>

      {missingTranslations.length > 0 && activeLocale === defaultLocale && (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-status-warning-text)]">
            {missingTranslations.length}{" "}
            {missingTranslations.length === 1 ? "ítem sin traducción" : "ítems sin traducción"} al inglés.
          </p>
          <p className="mt-1 text-xs text-[var(--color-status-warning-text)]">
            Las traducciones EN pueden quedar desactualizadas si editas el origen sin regenerar ese idioma.
            Pulsa <strong>Generar</strong> junto a la pestaña EN para actualizar automáticamente.
          </p>
        </div>
      )}

      <div className="mt-6">
        {items.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-border-default)] px-8 py-12 text-center">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {activeLocale === defaultLocale
                ? "Sin items de conocimiento"
                : `Sin items en ${activeLocale.toUpperCase()}`}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {activeLocale === defaultLocale
                ? "Pulsa «Regenerar todo» para extraer conocimiento automáticamente de los datos de la propiedad, o crea un item manual."
                : `Pulsa «Generar» junto a la pestaña ${activeLocale.toUpperCase()} para generar automáticamente los ítems en este idioma.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <KnowledgeItemCard
                key={item.id}
                item={{
                  id: item.id,
                  topic: item.topic,
                  bodyMd: item.bodyMd,
                  visibility: item.visibility,
                  journeyStage: item.journeyStage,
                  confidenceScore: item.confidenceScore,
                  lastVerifiedAt: item.lastVerifiedAt?.toISOString() ?? null,
                  chunkType: item.chunkType,
                  entityType: item.entityType,
                  contextPrefix: item.contextPrefix,
                }}
                propertyId={propertyId}
                visibilityLabel={VISIBILITY_LABEL[item.visibility]}
                visibilityTone={VISIBILITY_TONE[item.visibility]}
                journeyLabel={
                  item.journeyStage
                    ? (JOURNEY_LABEL[item.journeyStage] ?? item.journeyStage)
                    : null
                }
              />
            ))}
          </div>
        )}

        {activeLocale === defaultLocale && (
          <div className="mt-8">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
              Añadir item de conocimiento
            </h3>
            <CreateKnowledgeItemForm propertyId={propertyId} />
          </div>
        )}
      </div>
    </div>
  );
}
