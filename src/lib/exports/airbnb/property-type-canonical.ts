import {
  propertyTypes,
  validatePlatformMapping,
} from "@/lib/taxonomy-loader";
import type { PlatformMapping } from "@/lib/types/taxonomy";

export interface PropertyTypeCanonicalResolution {
  /** First Airbnb external_id in `source[]`, treated as the canonical outbound value. */
  canonical: string | null;
  /** Remaining Airbnb external_ids in `source[]` after the canonical (semantic aliases). */
  alternatives: string[];
  /** True when the item exists but is explicitly `platform_supported: false`. */
  platformUnsupported: boolean;
  /** True when no taxonomy item matches the given id. */
  unknown: boolean;
}

// Rule: the first Airbnb mapping in `source[]` is the canonical outbound value.
// Isolated from `getAirbnbId` so the rule can evolve (explicit primary field,
// host-picked alias, etc.) without touching the engine, and so the orchestrator
// can emit a warning listing the skipped alternatives.
export function resolvePropertyTypeCanonical(
  propertyTypeId: string | null | undefined,
): PropertyTypeCanonicalResolution {
  if (!propertyTypeId) {
    return { canonical: null, alternatives: [], platformUnsupported: false, unknown: true };
  }

  const item = propertyTypes.items.find((i) => i.id === propertyTypeId);
  if (!item) {
    return { canonical: null, alternatives: [], platformUnsupported: false, unknown: true };
  }

  if (item.platform_supported === false) {
    return {
      canonical: null,
      alternatives: [],
      platformUnsupported: true,
      unknown: false,
    };
  }

  const airbnbExternalIds: string[] = [];
  for (const entry of item.source ?? []) {
    if (validatePlatformMapping(entry) !== null) continue;
    const mapping = entry as PlatformMapping;
    if (mapping.platform === "airbnb" && mapping.kind === "external_id") {
      airbnbExternalIds.push(mapping.external_id);
    }
  }

  if (airbnbExternalIds.length === 0) {
    return { canonical: null, alternatives: [], platformUnsupported: false, unknown: false };
  }

  const [canonical, ...alternatives] = airbnbExternalIds;
  return { canonical, alternatives, platformUnsupported: false, unknown: false };
}
