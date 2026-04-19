import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CreateKnowledgeItemForm } from "./create-knowledge-form";
import { KnowledgeItemCard } from "./knowledge-item-card";
import { RegenerateKnowledgeButton } from "./regenerate-knowledge-button";
import { LocaleSwitcherClient } from "./locale-switcher";
import { VISIBILITY_LABEL, VISIBILITY_TONE } from "@/lib/visibility";
import {
  SUPPORTED_LOCALES,
  getLocaleStatusForProperty,
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

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { propertyId } = await params;
  const { locale: localeParam } = await searchParams;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, defaultLocale: true },
  });

  if (!property) notFound();

  const defaultLocale = property.defaultLocale;
  const activeLocale = localeParam ?? defaultLocale;

  const [items, localeStatuses, missingTranslations] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where: { propertyId, locale: activeLocale },
      orderBy: [{ entityType: "asc" }, { topic: "asc" }],
    }),
    getLocaleStatusForProperty(propertyId, [...SUPPORTED_LOCALES]),
    listMissingTranslations(propertyId, defaultLocale, [...SUPPORTED_LOCALES]),
  ]);

  const nonDefaultMissing = missingTranslations.filter((m) =>
    m.missingLocales.some((l) => l !== defaultLocale),
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Base de conocimiento
          </h1>
          <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
            Verdad estructurada reutilizable por guías, AI y mensajería.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RegenerateKnowledgeButton propertyId={propertyId} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm font-medium text-[var(--color-neutral-600)]">Idioma:</span>
        <LocaleSwitcherClient
          propertyId={propertyId}
          defaultLocale={defaultLocale}
          activeLocale={activeLocale}
          localeStatuses={localeStatuses}
        />
      </div>

      {nonDefaultMissing.length > 0 && activeLocale === defaultLocale && (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-warning-300)] bg-[var(--color-warning-50)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-warning-800)]">
            {nonDefaultMissing.length} {nonDefaultMissing.length === 1 ? "ítem sin traducción" : "ítems sin traducción"} al inglés.
          </p>
          <p className="mt-1 text-xs text-[var(--color-warning-700)]">
            Las traducciones EN pueden quedar desactualizadas si editas el origen sin regenerar ese idioma.
            Pulsa <strong>Generar</strong> junto a la pestaña EN para actualizar automáticamente.
          </p>
        </div>
      )}

      <div className="mt-8">
        {items.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {activeLocale === defaultLocale
                ? "Sin items de conocimiento"
                : `Sin items en ${activeLocale.toUpperCase()}`}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
              {activeLocale === defaultLocale
                ? "Pulsa «Regenerar todo» para extraer conocimiento automáticamente de los datos de la propiedad, o crea un item manual."
                : `Pulsa «Generar» junto a la pestaña ${activeLocale.toUpperCase()} para generar automáticamente los ítems en este idioma.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const visLabel = VISIBILITY_LABEL[item.visibility];
              const visTone = VISIBILITY_TONE[item.visibility];
              const journey = item.journeyStage
                ? (JOURNEY_LABEL[item.journeyStage] ?? item.journeyStage)
                : null;
              return (
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
                  visibilityLabel={visLabel}
                  visibilityTone={visTone}
                  journeyLabel={journey}
                />
              );
            })}
          </div>
        )}

        {activeLocale === defaultLocale && (
          <div className="mt-8">
            <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
              Añadir item de conocimiento
            </h2>
            <CreateKnowledgeItemForm propertyId={propertyId} />
          </div>
        )}
      </div>
    </div>
  );
}
