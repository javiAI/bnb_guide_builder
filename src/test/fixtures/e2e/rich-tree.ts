import type { GuideItem, GuideMedia, GuideTree } from "@/lib/types/guide-tree";

const MEDIA_LIVING: GuideMedia = {
  assetId: "asset-living",
  variants: {
    thumb: "/e2e-fixtures/living-room.svg",
    md: "/e2e-fixtures/living-room.svg",
    full: "/e2e-fixtures/living-room.svg",
  },
  mimeType: "image/svg+xml",
  alt: "Salón con sofá y ventanal",
};

const MEDIA_COVER: GuideMedia = {
  assetId: "asset-cover",
  variants: {
    thumb: "/e2e-fixtures/cover.svg",
    md: "/e2e-fixtures/cover.svg",
    full: "/e2e-fixtures/cover.svg",
  },
  mimeType: "image/svg+xml",
  alt: "Fachada del apartamento",
};

const MEDIA_KITCHEN: GuideMedia = {
  assetId: "asset-kitchen",
  variants: {
    thumb: "/e2e-fixtures/kitchen.svg",
    md: "/e2e-fixtures/kitchen.svg",
    full: "/e2e-fixtures/kitchen.svg",
  },
  mimeType: "image/svg+xml",
  alt: "Cocina totalmente equipada",
};

function baseItem(partial: Partial<GuideItem> & Pick<GuideItem, "id" | "label">): GuideItem {
  return {
    taxonomyKey: null,
    value: null,
    visibility: "guest",
    deprecated: false,
    warnings: [],
    fields: [],
    media: [],
    children: [],
    ...partial,
  };
}

/** Rich E2E fixture — populates every section type with real taxonomy keys
 * (`sp.*`, `am.*`, `pol.*`, `ct.*`) so presenters resolve without falling to
 * the raw sentinel. Exercises arrival media, spaces with nested amenities,
 * policies, and a tappable contact in emergency. */
export function buildRichTree(): GuideTree {
  return {
    schemaVersion: 3,
    propertyId: "e2e-rich",
    audience: "internal",
    generatedAt: "2026-04-18T00:00:00.000Z",
    sections: [
      {
        id: "gs.essentials",
        label: "Esenciales",
        order: 5,
        resolverKey: "essentials",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        journeyStage: "arrival",
        isHero: true,
        isAggregator: true,
        sourceResolverKeys: ["arrival", "amenities", "rules"],
        quickActionKeys: [
          "wifi_copy",
          "call_host",
          "whatsapp_host",
          "maps_open",
          "access_how",
        ],
        hideWhenEmptyForGuest: true,
        items: [
          baseItem({
            id: "essentials.arrival.arrival.checkin",
            taxonomyKey: "am.checkin_instructions",
            label: "Check-in",
            value: "Puerta principal, código 1234",
            journeyTags: ["essential"],
            journeyStage: "arrival",
            fields: [
              { label: "Hora", value: "16:00", visibility: "guest" },
            ],
          }),
          baseItem({
            id: "essentials.arrival.arrival.location",
            label: "Ubicación",
            value: "Calle Mayor 12, 28013 Madrid",
            journeyTags: ["essential"],
            journeyStage: "arrival",
          }),
          baseItem({
            id: "essentials.amenities.am.wifi",
            taxonomyKey: "am.wifi",
            label: "Wi-Fi",
            value: "Red: CasaClaudia",
            journeyTags: ["essential"],
            journeyStage: "arrival",
            fields: [
              { label: "Nombre de red", value: "CasaClaudia", visibility: "guest" },
              { label: "Contraseña", value: "welcome2026", visibility: "guest" },
            ],
          }),
        ],
      },
      {
        id: "gs.arrival",
        label: "Llegada",
        order: 10,
        resolverKey: "arrival",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        emptyCopy: "Añade instrucciones de llegada.",
        emptyCopyGuest: "Detalles de llegada.",
        journeyStage: "arrival",
        items: [
          baseItem({
            id: "arrival.cover",
            label: "Portada",
            media: [MEDIA_COVER],
          }),
          baseItem({
            id: "arrival.checkin",
            taxonomyKey: "am.checkin_instructions",
            label: "Check-in",
            value: "Puerta principal, código 1234",
            fields: [
              { label: "Hora", value: "16:00", visibility: "guest" },
              { label: "Acceso", value: "Llave bajo el felpudo", visibility: "guest" },
            ],
          }),
          baseItem({
            id: "arrival.access",
            taxonomyKey: "am.smartlock",
            label: "Cómo entrar",
            value: "Cerradura inteligente con código 1234",
            journeyTags: ["essential"],
            journeyStage: "arrival",
          }),
          baseItem({
            id: "arrival.location",
            label: "Ubicación",
            value: "Calle Mayor 12, 28013 Madrid",
            journeyTags: ["essential"],
            journeyStage: "arrival",
          }),
        ],
      },
      {
        id: "gs.spaces",
        label: "Espacios",
        order: 20,
        resolverKey: "spaces",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        emptyCopy: "Añade espacios.",
        emptyCopyGuest: "Recorre los espacios.",
        items: [
          baseItem({
            id: "space.living",
            taxonomyKey: "sp.living_room",
            label: "Salón",
            value: "Salón",
            fields: [
              { label: "Aforo", value: "4 personas", visibility: "guest" },
            ],
            media: [MEDIA_LIVING],
            children: [
              baseItem({
                id: "space.living.tv",
                taxonomyKey: "am.smart_tv",
                label: "Smart TV",
                value: "TV 55\" con Netflix y HBO",
              }),
            ],
          }),
          baseItem({
            id: "space.kitchen",
            taxonomyKey: "sp.kitchen",
            label: "Cocina",
            value: "Cocina",
            fields: [
              { label: "Equipamiento", value: "Vitrocerámica, horno, lavavajillas", visibility: "guest" },
            ],
            media: [MEDIA_KITCHEN],
          }),
        ],
      },
      {
        id: "gs.amenities",
        label: "Equipamiento",
        order: 30,
        resolverKey: "amenities",
        sortBy: "recommended_first",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        emptyCopy: "Añade equipamiento.",
        emptyCopyGuest: "Equipamiento disponible durante tu estancia.",
        items: [
          baseItem({
            id: "am.wifi",
            taxonomyKey: "am.wifi",
            label: "Wi-Fi",
            value: "Red: CasaClaudia",
            journeyTags: ["essential"],
            fields: [
              { label: "Nombre de red", value: "CasaClaudia", visibility: "guest" },
              { label: "Contraseña", value: "welcome2026", visibility: "guest" },
            ],
          }),
          baseItem({
            id: "am.coffee",
            taxonomyKey: "am.coffee_machine",
            label: "Cafetera",
            value: "Cafetera de cápsulas Nespresso",
          }),
          baseItem({
            id: "am.heating",
            taxonomyKey: "am.heating",
            label: "Calefacción",
            value: "Radiadores individuales en cada habitación",
          }),
        ],
      },
      {
        id: "gs.rules",
        label: "Normas de la casa",
        order: 40,
        resolverKey: "rules",
        sortBy: "taxonomy_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        emptyCopy: "Añade políticas.",
        emptyCopyGuest: "Normas destacadas para tu estancia.",
        items: [
          baseItem({
            id: "policy.smoking",
            taxonomyKey: "pol.smoking",
            label: "Fumar",
            value: "No se permite fumar dentro del alojamiento.",
          }),
          baseItem({
            id: "policy.pets",
            taxonomyKey: "pol.pets",
            label: "Mascotas",
            value: "Mascotas permitidas hasta 10 kg con coste adicional.",
            fields: [
              { label: "Coste", value: "50 € por estancia", visibility: "guest" },
            ],
          }),
        ],
      },
      {
        id: "gs.emergency",
        label: "Ayuda y emergencias",
        order: 70,
        resolverKey: "emergency",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        emptyCopy: "Añade contactos.",
        emptyCopyGuest:
          "Si necesitas ayuda durante la estancia, contacta con tu anfitrión.",
        items: [
          baseItem({
            id: "ct.host.primary",
            taxonomyKey: "ct.host",
            label: "Ana (anfitriona)",
            value: "Ana",
            fields: [
              { label: "Teléfono", value: "+34 600 111 222", visibility: "guest" },
              { label: "Email", value: "ana@example.com", visibility: "guest" },
            ],
          }),
        ],
      },
    ],
    brandPaletteKey: null,
    brandLogoUrl: null,
  };
}
