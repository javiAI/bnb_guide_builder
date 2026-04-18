import type { GuideTree } from "@/lib/types/guide-tree";

/** Empty-tree fixture (E2E). Every section has zero items. Some declare
 * `emptyCopyGuest` so the guest sees a neutral empty state; others declare
 * `hideWhenEmptyForGuest: true` so the section is dropped entirely. Together
 * they exercise the two paths in `shouldHideSection` / `filterRenderableItems`
 * without leaking host `emptyCopy`. */
export function buildEmptyTree(): GuideTree {
  return {
    schemaVersion: 3,
    propertyId: "e2e-empty",
    audience: "internal",
    generatedAt: "2026-04-18T00:00:00.000Z",
    sections: [
      {
        id: "gs.arrival",
        label: "Llegada",
        order: 10,
        resolverKey: "arrival",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        emptyCopy: "Añade instrucciones de llegada.",
        emptyCopyGuest:
          "Las instrucciones de llegada se comparten más cerca del check-in.",
        journeyStage: "arrival",
        items: [],
      },
      {
        id: "gs.howto",
        label: "Cómo usar",
        order: 25,
        resolverKey: "howto",
        sortBy: "taxonomy_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        emptyCopy: "Añade runbooks a tus amenities.",
        hideWhenEmptyForGuest: true,
        items: [],
      },
      {
        id: "gs.emergency",
        label: "Ayuda y emergencias",
        order: 70,
        resolverKey: "emergency",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        emptyCopy: "Añade contactos de emergencia.",
        emptyCopyGuest:
          "Si necesitas ayuda durante la estancia, contacta con tu anfitrión.",
        items: [],
      },
    ],
    brandPaletteKey: null,
    brandLogoUrl: null,
  };
}
