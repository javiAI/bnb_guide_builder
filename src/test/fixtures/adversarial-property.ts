import type {
  GuideItem,
  GuideSection,
  GuideTree,
} from "@/lib/types/guide-tree";

/** Adversarial `GuideTree` — packs in every known leak shape so invariant
 * tests can catch regressions across all five QA gates (QA_AND_RELEASE §3):
 *   1. raw JSON blob in `value`
 *   2. taxonomy enum keys (`ct.host`, `rm.smoking_outdoor_only`, …)
 *   3. editorial host copy in `emptyCopy` when the section has content
 *   4. internal labels like "Slot" / "Config JSON" on fields
 *   5. items that reach the renderer without a matching presenter (live via
 *      `rawSentinelPresenter` since 10F iteration 2)
 *
 * Also plants a section with no items + no `emptyCopyGuest` + no
 * `hideWhenEmptyForGuest` so tests confirm it is hidden silently (instead
 * of falling back to the host `emptyCopy`).
 *
 * This is a *pre-normalization* fixture — it mirrors what `composeGuide`
 * might emit before `normalizeGuideForPresentation` runs. Tests apply the
 * normalizer and assert the invariants on the output. */
export function buildAdversarialTree(): GuideTree {
  return {
    schemaVersion: 3,
    propertyId: "adv-1",
    audience: "guest",
    generatedAt: "2026-04-18T00:00:00.000Z",
    sections: [
      buildRulesSection(),
      buildEmergencySection(),
      buildHowtoSection(),
      buildArrivalSection(),
      buildOrphanSection(),
    ],
    brandPaletteKey: null,
    brandLogoUrl: null,
  };
}

function buildRulesSection(): GuideSection {
  return {
    id: "gs.rules",
    label: "Normas de la casa",
    order: 40,
    resolverKey: "rules",
    sortBy: "taxonomy_order",
    emptyCtaDeepLink: null,
    maxVisibility: "internal",
    // Raw host-editorial copy that must never reach guest:
    emptyCopy: "Añade políticas de ruido, fumar y mascotas.",
    emptyCopyGuest: "No hay normas adicionales destacadas para esta estancia.",
    items: [
      // Leak 1: raw JSON blob in value (pets policy). The nested `allowed: true`
      // must surface as a warning once expandObject propagates correctly.
      {
        id: "policy.pol.pets",
        taxonomyKey: "pol.pets",
        label: "Mascotas",
        value: '{"allowed":true,"fee":50,"hidden_key":"rm.noise_outdoor_only"}',
        visibility: "guest",
        deprecated: false,
        warnings: [],
        fields: [],
        media: [],
        children: [],
      },
      // Leak 2: taxonomy enum key as value
      {
        id: "policy.pol.smoking",
        taxonomyKey: "pol.smoking",
        label: "Fumar",
        value: "rm.smoking_outdoor_only",
        visibility: "guest",
        deprecated: false,
        warnings: [],
        fields: [],
        media: [],
        children: [],
      },
      // Leak 4: internal-looking field labels + a raw-sentinel child buried
      // under a renderable parent. Before recursive filtering, the unknown-
      // prefix child was rendered in the `<ol>` children list of md/html/pdf
      // and the React component, leaking the label to guests.
      {
        id: "policy.pol.quiet_hours",
        taxonomyKey: "pol.quiet_hours",
        label: "Horas de silencio",
        value: "",
        visibility: "guest",
        deprecated: false,
        warnings: [],
        fields: [
          { label: "Slot", value: "22:00-08:00", visibility: "guest" },
          { label: "Config JSON", value: '{"enforced":true}', visibility: "guest" },
        ],
        media: [],
        children: [
          {
            id: "policy.pol.quiet_hours.nested",
            taxonomyKey: "unknown.nested_noise",
            label: "Sensor interno",
            value: "unknown.nested_noise",
            visibility: "guest",
            deprecated: false,
            warnings: [],
            fields: [],
            media: [],
            children: [],
          },
        ],
      },
    ],
  };
}

function buildEmergencySection(): GuideSection {
  const host: GuideItem = {
    id: "ct.host.1",
    taxonomyKey: "ct.host",
    label: "Ana (anfitriona)",
    // Leak 2 (again): roleKey as value
    value: "ct.host",
    visibility: "guest",
    deprecated: false,
    warnings: [],
    fields: [
      { label: "Teléfono", value: "+34 600 000 000", visibility: "guest" },
      { label: "Email", value: "ana@example.com", visibility: "guest" },
    ],
    media: [],
    children: [],
  };
  return {
    id: "gs.emergency",
    label: "Ayuda y emergencias",
    order: 70,
    resolverKey: "emergency",
    sortBy: "explicit_order",
    emptyCtaDeepLink: null,
    maxVisibility: "internal",
    emptyCopy: "Añade contactos de emergencia para que aparezcan aquí.",
    emptyCopyGuest: "Si necesitas ayuda durante la estancia, contacta con tu anfitrión.",
    items: [host],
  };
}

function buildHowtoSection(): GuideSection {
  return {
    id: "gs.howto",
    label: "Cómo usar",
    order: 25,
    resolverKey: "howto",
    sortBy: "taxonomy_order",
    emptyCtaDeepLink: null,
    maxVisibility: "internal",
    emptyCopy: "Añade runbooks a tus amenities.",
    hideWhenEmptyForGuest: true,
    items: [], // empty → guest renderer must hide the section entirely
  };
}

/** Leak 5: a `taxonomyKey` prefix that is neither specialized nor in the
 * fallback allowlist. The registry must route this through
 * `rawSentinelPresenter` so the item is hidden from guest output. */
function buildArrivalSection(): GuideSection {
  return {
    id: "gs.arrival",
    label: "Llegada",
    order: 10,
    resolverKey: "howto",
    sortBy: "taxonomy_order",
    emptyCtaDeepLink: null,
    maxVisibility: "internal",
    emptyCopy: "Añade instrucciones de llegada.",
    emptyCopyGuest: "Las instrucciones de llegada se comparten más cerca del check-in.",
    items: [
      {
        id: "arrival.unknown",
        taxonomyKey: "arrival.checkin_code",
        label: "Código de entrada",
        value: "arrival.checkin_code",
        visibility: "guest",
        deprecated: false,
        warnings: [],
        fields: [],
        media: [],
        children: [],
      },
    ],
  };
}

/** A section with no items, no `emptyCopyGuest`, and no `hideWhenEmptyForGuest`.
 * The renderer must hide it silently (and log `guest-section-missing-empty-copy`)
 * rather than falling through to the host `emptyCopy`. */
function buildOrphanSection(): GuideSection {
  return {
    id: "gs.orphan",
    label: "Sección huérfana",
    order: 999,
    resolverKey: "howto",
    sortBy: "explicit_order",
    emptyCtaDeepLink: null,
    maxVisibility: "internal",
    emptyCopy: "Añade algo aquí para que aparezca en la guía.",
    items: [],
  };
}
