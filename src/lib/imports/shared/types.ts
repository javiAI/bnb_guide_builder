// Canonical shape for platform imports (Rama 14D).
//
// Simétrico de `PropertyExportContext` (src/lib/exports/shared/load-property.ts)
// pero con semántica de INPUT: cada proveedor (Airbnb today, Booking later)
// parsea su payload a este shape, y el reconciler `computeImportDiff` trabaja
// contra él sin conocer detalles de la plataforma.
//
// Rama 14D es PREVIEW-ONLY: nunca se muta DB desde este módulo. Los tipos
// expresan "propuesta entrante" + "diagnóstico de reconciliación", no "patch".

import type { PoliciesShape } from "@/lib/exports/shared/policies-shape";

// ── Input canónico ──────────────────────────────────────────────────────

/** Resolución de un external_id a taxonomy interno. Si `taxonomyId` es null,
 *  el external_id no matcheó ningún item — el reconciler lo promueve a
 *  `customs` (fallback suggestion), nunca lo resuelve silenciosamente. */
export interface ExternalIdResolution {
  taxonomyId: string | null;
  sourceExternalId: string;
  sourceLabelEn: string | null;
}

export interface PropertyImportContext {
  propertyType: ExternalIdResolution | null;
  customPropertyTypeLabel: null; // siempre null — el custom label va a `customs` del diff
  bedroomsCount: number | null;
  bathroomsCount: number | null;
  personCapacity: number | null;
  primaryAccessMethod: ExternalIdResolution | null;
  customAccessMethodLabel: null; // siempre null — ver arriba
  /** Sub-claves de PoliciesShape que el payload aportó. Ausencia = no trajo señal. */
  policiesPartial: Partial<PoliciesShape>;
  /** am.* / ax.* taxonomy ids resueltos desde `amenity_ids[]` del payload. */
  incomingAmenityKeys: ReadonlySet<string>;
  /** Booleanos de presencia planos — el reconciler los marca `unactionable`
   *  con reason `presence_signal_only` por defecto. Se preservan para que el
   *  host los vea en el preview. */
  presencePings: {
    /** shared_spaces.kitchen, shared_spaces.living_room, shared_spaces.dining */
    sharedSpaces: Readonly<Record<string, boolean>>;
    /** amenities.workspace, amenities.balcony, ... (shell bools sin shape interno) */
    amenitiesShellBools: Readonly<Record<string, boolean>>;
    /** accessibility_features.* booleans */
    accessibilityFeatures: Readonly<Record<string, boolean>>;
  };
  /** Free-text entrante. No reconciliable — aparece en el diff como `freeText`. */
  freeText: {
    houseRules: string | null;
    checkInInstructions: string | null; // Booking check-in instructions
  };
  /** Pricing entrante. Si llega sin currency → `requires_currency_decision`. */
  pricing: {
    cleaningFee: number | null;
    extraPersonFee: number | null;
    currency: string | null;
  };
  /** external_ids que no resolvieron a ningún taxonomy item — origen de warnings y `customs` entries. */
  unresolvedExternalIds: ReadonlyArray<{
    field: "amenity_ids" | "property_type_category" | "check_in_method";
    value: string;
    labelEn: string | null;
  }>;
  /** Locale declarado por el payload (no el de la Property). */
  incomingLocale: string | null;
}

// ── Warnings del pipeline de import ─────────────────────────────────────

export type ImportWarningCode =
  /** `external_id` del payload no matchea ningún taxonomy item conocido. */
  | "unresolved_external_id"
  /** `external_id` del payload apunta a un item cubierto pero `platform_supported: false`. */
  | "platform_not_supported"
  /** Payload en locale ≠ `defaultLocale` de la Property — relevante para house_rules. */
  | "locale_mismatch"
  /** Recordatorio explícito: free-text nunca se reconcilia campo a campo. */
  | "free_text_not_reconciled"
  /** Supplements/fees llegaron sin `currency` — `requires_currency_decision`. */
  | "requires_currency_for_fees"
  /** Smoking enum con vocabulario ≠ interno — passthrough sin mapping. */
  | "enum_value_passthrough";

export interface ImportWarning {
  code: ImportWarningCode;
  field?: string;
  taxonomyKey?: string;
  message: string;
}

// ── Diff ─────────────────────────────────────────────────────────────────

export type DiffStatus = "fresh" | "identical" | "conflict" | "unactionable";

/** Obligatorio en toda entry con status="unactionable" (gate en tests). */
export type UnactionableReason =
  /** Incoming pide create/delete de entidad con identidad propia (Space, amenityInstance con featuresJson/subtype/configJson). Fuera del scope preview-only. */
  | "requires_entity_identity"
  /** Señal plana de presencia (boolean sin shape interno reconstruible). */
  | "presence_signal_only"
  /** Incoming fue derivado de entidades DB (p.ej. room_counter cuando ya hay Spaces) — reaplicar sería tautológico o destructivo. */
  | "lossy_projection"
  /** Valor financiero entrante sin `currency` resuelto en Property. */
  | "requires_currency_decision";

export type SuggestedAction = "take_import" | "keep_db";

/** Entry reconciliable (scalar top-level + policies sub-keys). */
export interface ReconcilableDiffEntry {
  field: string;
  current: unknown;
  incoming: unknown;
  status: Exclude<DiffStatus, "unactionable">;
  suggestedAction: SuggestedAction;
}

/** Entry no reconciliable con reason OBLIGATORIA. */
export interface UnactionableDiffEntry {
  field: string;
  incoming: unknown;
  status: "unactionable";
  reason: UnactionableReason;
  message: string;
}

export type DiffEntry = ReconcilableDiffEntry | UnactionableDiffEntry;

/** Amenities con identidad taxonómica: set-diff plano (add/remove/identical).
 *  `add` sugiere creación de amenityInstance shell pero el preview NO crea
 *  nada (preview-only). `remove` es siempre conservador: warning, no sugerido.
 *  Note: `sourceExternalId` in `add` is always null because the parser discards
 *  that metadata when resolving amenities to taxonomy IDs. The UI reads labels
 *  from the taxonomy itself. */
export interface AmenitiesDiff {
  add: ReadonlyArray<{
    taxonomyId: string;
    sourceExternalId: string | null;
    sourceLabelEn: string | null;
  }>;
  remove: ReadonlyArray<{
    taxonomyId: string;
  }>;
  identicalCount: number;
}

/** Free text: siempre diff-only (no reconciliable), sin status. */
export interface FreeTextDiffEntry {
  field: "houseRules" | "checkInInstructions";
  current: string | null;
  incoming: string | null;
}

/** Custom label fallback: NUNCA resolvemos un scalar con custom.
 *  Aparece como sugerencia separada que el host decide manualmente. */
export interface CustomsDiffEntry {
  field: "propertyType" | "primaryAccessMethod";
  sourceExternalId: string;
  sourceLabelEn: string | null;
  reason: "no_matching_taxonomy_item";
  suggestedCustomLabel: string;
}

export interface ImportDiffMeta {
  generatedAt: string;
  payloadShape: "airbnb-v1" | "booking-v1";
  currentLocale: string;
  incomingLocale: string | null;
}

export interface ImportDiff {
  /** Top-level Property scalars (propertyType, bedroomsCount, bathroomsCount,
   *  personCapacity, primaryAccessMethod). */
  scalar: ReadonlyArray<DiffEntry>;
  /** Sub-keys de `policiesJson` (smoking, events.policy, pets.allowed, ...). */
  policies: ReadonlyArray<DiffEntry>;
  /** Booleanos de presencia (shared_spaces, amenity shells, accessibility features).
   *  Siempre `status: "unactionable"` con reason concreta. */
  presence: ReadonlyArray<UnactionableDiffEntry>;
  /** Listas con identidad taxonómica (amenityInstances). */
  amenities: AmenitiesDiff;
  /** Campos de texto libre (house_rules). Siempre diff-only. */
  freeText: ReadonlyArray<FreeTextDiffEntry>;
  /** Fallback suggestions para external_ids sin match interno. */
  customs: ReadonlyArray<CustomsDiffEntry>;
  meta: ImportDiffMeta;
}

/** Output completo del preview: diff + warnings acumulados. */
export interface ImportPreviewResult {
  diff: ImportDiff;
  warnings: ReadonlyArray<ImportWarning>;
}

// ── Errores ──────────────────────────────────────────────────────────────

export class ImportPayloadParseError extends Error {
  readonly issues: ReadonlyArray<string>;
  constructor(issues: ReadonlyArray<string>) {
    super(`Import payload failed to parse: ${issues.join("; ")}`);
    this.name = "ImportPayloadParseError";
    this.issues = issues;
  }
}
