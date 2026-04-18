import type { GuideTree } from "@/lib/types/guide-tree";

/** Empty-tree fixture (E2E). All 6 canonical sections present, every one
 * with zero items. Each section exercises a distinct empty-state path so
 * the harness covers `shouldHideSection` / `filterRenderableItems` end to
 * end:
 *
 *   - `arrival` (hero) → `emptyCopyGuest` neutral copy.
 *   - `spaces`         → `hideWhenEmptyForGuest: true` (drop entire section).
 *   - `amenities`      → `emptyCopyGuest` neutral copy.
 *   - `rules`          → neither — silent hide + `guest-section-missing-empty-copy` log.
 *   - `howto`          → `hideWhenEmptyForGuest: true`.
 *   - `emergency`      → `emptyCopyGuest` neutral copy.
 *
 * Every section keeps a planted host-editorial `emptyCopy` ("Añade…") so
 * the leak spec keeps biting if anything bypasses the normalizer. */
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
        isHero: true,
        items: [],
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
        hideWhenEmptyForGuest: true,
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
        id: "gs.amenities",
        label: "Equipamiento",
        order: 30,
        resolverKey: "amenities",
        sortBy: "recommended_first",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        emptyCopy: "Añade equipamiento.",
        emptyCopyGuest: "Equipamiento disponible durante tu estancia.",
        items: [],
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
