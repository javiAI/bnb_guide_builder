import { asPolicies } from "@/lib/exports/shared/policies-shape";
import type { PropertyExportContext } from "@/lib/exports/shared/load-property";
import type {
  AmenitiesDiff,
  CustomsDiffEntry,
  DiffEntry,
  FreeTextDiffEntry,
  ImportDiff,
  ImportWarning,
  PropertyImportContext,
  UnactionableDiffEntry,
} from "./types";

/**
 * Reconcile the current Property state (loaded via `loadPropertyContext`,
 * shared with exports) against an incoming canonical payload parsed by a
 * provider-specific parser. Provider-agnostic: knows nothing about Airbnb
 * or Booking.
 *
 * Semantics by category (see docs/FEATURES/PLATFORM_INTEGRATIONS.md):
 *   scalar   — Property top-level fields. Three reconcilable states.
 *   policies — sub-keys of policiesJson. Reconcilable OR `lossy_projection`
 *              when the incoming mapping degrades current granularity.
 *   presence — shared_spaces, amenity shell bools, accessibility features.
 *              ALWAYS unactionable with `presence_signal_only`.
 *   amenities — set diff (add/remove/identical) on taxonomy keys.
 *   freeText — diff-only, never reconcilable (no status).
 *   customs  — fallback suggestions for external_ids without internal match.
 */
export function computeImportDiff(
  current: PropertyExportContext,
  incoming: PropertyImportContext,
  options: {
    now?: () => Date;
    payloadShape: ImportDiff["meta"]["payloadShape"];
  },
): { diff: ImportDiff; warnings: ReadonlyArray<ImportWarning> } {
  const warnings: ImportWarning[] = [];
  const scalar: DiffEntry[] = [];
  const policies: DiffEntry[] = [];
  const presence: UnactionableDiffEntry[] = [];
  const freeText: FreeTextDiffEntry[] = [];
  const customs: CustomsDiffEntry[] = [];

  // ── Scalar top-level fields ─────────────────────────────────────────
  if (incoming.propertyType && incoming.propertyType.taxonomyId !== null) {
    scalar.push(
      scalarEntry(
        "propertyType",
        current.propertyType,
        incoming.propertyType.taxonomyId,
      ),
    );
  }

  if (incoming.primaryAccessMethod && incoming.primaryAccessMethod.taxonomyId !== null) {
    scalar.push(
      scalarEntry(
        "primaryAccessMethod",
        current.primaryAccessMethod,
        incoming.primaryAccessMethod.taxonomyId,
      ),
    );
  }

  if (incoming.bedroomsCount !== null) {
    scalar.push(
      scalarEntry("bedroomsCount", current.bedroomsCount, incoming.bedroomsCount),
    );
  }
  if (incoming.bathroomsCount !== null) {
    scalar.push(
      scalarEntry(
        "bathroomsCount",
        current.bathroomsCount,
        incoming.bathroomsCount,
      ),
    );
  }
  if (incoming.personCapacity !== null) {
    scalar.push(
      scalarEntry("personCapacity", current.personCapacity, incoming.personCapacity),
    );
  }

  // ── Policies sub-keys ───────────────────────────────────────────────
  const currentPolicies = asPolicies(current.policiesJson);
  const p = incoming.policiesPartial;

  if (p.smoking !== undefined) {
    policies.push(scalarEntry("policies.smoking", currentPolicies.smoking ?? null, p.smoking));
  }

  if (p.events?.policy !== undefined) {
    const currentValue = currentPolicies.events?.policy ?? null;
    const incomingValue = p.events.policy;
    // Airbnb's events_allowed is binary — a DB value with finer granularity
    // (e.g. "allowed_quiet") is degraded to "allowed" on the inbound map.
    // We surface that as `lossy_projection` so the host sees the granularity
    // loss explicitly rather than a generic `conflict`.
    if (
      currentValue &&
      currentValue !== "not_allowed" &&
      currentValue !== "allowed" &&
      incomingValue === "allowed"
    ) {
      policies.push({
        field: "policies.events.policy",
        incoming: incomingValue,
        status: "unactionable",
        reason: "lossy_projection",
        message: `Incoming "allowed" would replace a more specific DB value "${currentValue}". Binary mapping degrades granularity.`,
      });
    } else {
      policies.push(scalarEntry("policies.events.policy", currentValue, incomingValue));
    }
  }

  if (p.pets?.allowed !== undefined) {
    policies.push(
      scalarEntry(
        "policies.pets.allowed",
        currentPolicies.pets?.allowed ?? null,
        p.pets.allowed,
      ),
    );
  }

  if (p.commercialPhotography !== undefined) {
    policies.push(
      scalarEntry(
        "policies.commercialPhotography",
        currentPolicies.commercialPhotography ?? null,
        p.commercialPhotography,
      ),
    );
  }

  // Pricing — always unactionable until Property has a currency field.
  if (incoming.pricing.cleaningFee !== null) {
    policies.push({
      field: "policies.supplements.cleaning.amount",
      incoming: incoming.pricing.cleaningFee,
      status: "unactionable",
      reason: "requires_currency_decision",
      message: `Incoming cleaning fee ${incoming.pricing.cleaningFee}${incoming.pricing.currency ? ` ${incoming.pricing.currency}` : " (no currency)"} cannot be stored: Property has no currency field.`,
    });
  }
  if (incoming.pricing.extraPersonFee !== null) {
    policies.push({
      field: "policies.supplements.extraGuest.amount",
      incoming: incoming.pricing.extraPersonFee,
      status: "unactionable",
      reason: "requires_currency_decision",
      message: `Incoming extra-person fee ${incoming.pricing.extraPersonFee}${incoming.pricing.currency ? ` ${incoming.pricing.currency}` : " (no currency)"} cannot be stored: Property has no currency field.`,
    });
  }

  // ── Presence pings — always unactionable, always presence_signal_only ──
  for (const [field, value] of Object.entries(incoming.presencePings.sharedSpaces)) {
    if (!value) continue;
    presence.push({
      field: `shared_spaces.${field}`,
      incoming: value,
      status: "unactionable",
      reason: "presence_signal_only",
      message: `Presence boolean "${field}" cannot create or modify Space entities; configure Spaces directly in the editor.`,
    });
  }
  for (const [field, value] of Object.entries(incoming.presencePings.amenitiesShellBools)) {
    if (!value) continue;
    presence.push({
      field: `amenities.${field}`,
      incoming: value,
      status: "unactionable",
      reason: "presence_signal_only",
      message: `Presence boolean "${field}" cannot create amenity shells without subtype/configJson; configure amenities directly.`,
    });
  }
  for (const [field, value] of Object.entries(incoming.presencePings.accessibilityFeatures)) {
    if (!value) continue;
    presence.push({
      field: `accessibility_features.${field}`,
      incoming: value,
      status: "unactionable",
      reason: "presence_signal_only",
      message: `Accessibility boolean "${field}" cannot create ax.* amenity entries without context; configure accessibility amenities directly.`,
    });
  }

  // ── Amenities set-diff ──────────────────────────────────────────────
  const add: Array<{
    taxonomyId: string;
    sourceExternalId: string | null;
    sourceLabelEn: string | null;
  }> = [];
  const remove: Array<{ taxonomyId: string }> = [];
  let identicalCount = 0;

  // Note: the incoming amenity resolution already carries `sourceLabelEn`
  // metadata in unresolvedExternalIds for entries that did NOT resolve.
  // Resolved entries only have the taxonomyId in `incomingAmenityKeys` — for
  // richer labels in `add`, the UI reads them from the taxonomy itself. We
  // don't re-denormalize labels here.
  for (const key of incoming.incomingAmenityKeys) {
    if (current.presentAmenityKeys.has(key)) {
      identicalCount++;
    } else {
      add.push({
        taxonomyId: key,
        sourceExternalId: null,
        sourceLabelEn: null,
      });
    }
  }
  for (const key of current.presentAmenityKeys) {
    if (!incoming.incomingAmenityKeys.has(key)) {
      remove.push({ taxonomyId: key });
    }
  }

  const amenities: AmenitiesDiff = { add, remove, identicalCount };

  // ── Free text ───────────────────────────────────────────────────────
  if (incoming.freeText.houseRules !== null) {
    freeText.push({
      field: "houseRules",
      // Current DB has no pre-rendered house_rules text (it's a derived
      // string assembled from policiesJson at export time). Showing `null`
      // here is honest: there is no stored counterpart to overwrite.
      current: null,
      incoming: incoming.freeText.houseRules,
    });
    warnings.push({
      code: "free_text_not_reconciled",
      field: "houseRules",
      message:
        "house_rules is diff-only. Incoming text is shown beside current (always null) — host edits individual policies manually if they want to absorb parts of the text.",
    });
  }

  // ── Free text: checkInInstructions (Booking provider) ──────────────────
  if (incoming.freeText.checkInInstructions !== null) {
    freeText.push({
      field: "checkInInstructions",
      current: null,
      incoming: incoming.freeText.checkInInstructions,
    });
    warnings.push({
      code: "free_text_not_reconciled",
      field: "checkInInstructions",
      message:
        "Check-in instructions are diff-only. Incoming text is shown for reference — host manually applies any parts that match their setup.",
    });
  }

  // ── Customs — only when external_id had no internal match ───────────
  if (
    incoming.propertyType &&
    incoming.propertyType.taxonomyId === null &&
    incoming.propertyType.sourceExternalId
  ) {
    customs.push({
      field: "propertyType",
      sourceExternalId: incoming.propertyType.sourceExternalId,
      sourceLabelEn: incoming.propertyType.sourceLabelEn,
      reason: "no_matching_taxonomy_item",
      suggestedCustomLabel: incoming.propertyType.sourceLabelEn ?? incoming.propertyType.sourceExternalId,
    });
  }
  if (
    incoming.primaryAccessMethod &&
    incoming.primaryAccessMethod.taxonomyId === null &&
    incoming.primaryAccessMethod.sourceExternalId
  ) {
    customs.push({
      field: "primaryAccessMethod",
      sourceExternalId: incoming.primaryAccessMethod.sourceExternalId,
      sourceLabelEn: incoming.primaryAccessMethod.sourceLabelEn,
      reason: "no_matching_taxonomy_item",
      suggestedCustomLabel: incoming.primaryAccessMethod.sourceLabelEn ?? incoming.primaryAccessMethod.sourceExternalId,
    });
  }

  // ── Locale mismatch warning ─────────────────────────────────────────
  if (
    incoming.incomingLocale !== null &&
    incoming.incomingLocale !== current.defaultLocale
  ) {
    warnings.push({
      code: "locale_mismatch",
      message: `Payload locale "${incoming.incomingLocale}" differs from property defaultLocale "${current.defaultLocale}". Relevant for house_rules free-text.`,
    });
  }

  const now = (options.now ?? (() => new Date()))();

  const diff: ImportDiff = {
    scalar,
    policies,
    presence,
    amenities,
    freeText,
    customs,
    meta: {
      generatedAt: now.toISOString(),
      payloadShape: options.payloadShape,
      currentLocale: current.defaultLocale,
      incomingLocale: incoming.incomingLocale,
    },
  };

  return { diff, warnings };
}

// ── helpers ─────────────────────────────────────────────────────────────

function scalarEntry(
  field: string,
  current: unknown,
  incoming: unknown,
): DiffEntry {
  if (current === null || current === undefined) {
    return {
      field,
      current: current ?? null,
      incoming,
      status: "fresh",
      suggestedAction: "take_import",
    };
  }
  if (deepEqual(current, incoming)) {
    return {
      field,
      current,
      incoming,
      status: "identical",
      suggestedAction: "keep_db",
    };
  }
  return {
    field,
    current,
    incoming,
    status: "conflict",
    suggestedAction: "keep_db",
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return false;
  // Arrays are not supported by this equality check; only plain objects.
  if (Array.isArray(a) || Array.isArray(b)) return false;
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false;
    }
  }
  return true;
}
