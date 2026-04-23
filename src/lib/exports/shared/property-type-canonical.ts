import {
  propertyTypes,
  validatePlatformMapping,
} from "@/lib/taxonomy-loader";
import type { PlatformMapping } from "@/lib/types/taxonomy";

export type ExportPlatform = "airbnb" | "booking";

export interface PropertyTypeCanonicalResolution {
  /** First external_id in `source[]` for the target platform — canonical outbound value. */
  canonical: string | null;
  /** Remaining external_ids in `source[]` after the canonical (semantic aliases). */
  alternatives: string[];
  /** True when the item exists but is explicitly `platform_supported: false`. */
  platformUnsupported: boolean;
  /** True when no taxonomy item matches the given id. */
  unknown: boolean;
}

// Rule: the first per-platform mapping in `source[]` is the canonical outbound
// value. Isolated from `getAirbnbId`/`getBookingId` so the rule can evolve
// (explicit primary field, host-picked alias, etc.) without touching the engine,
// and so the orchestrator can emit a warning listing the skipped alternatives.
export function resolvePropertyTypeCanonical(
  propertyTypeId: string | null | undefined,
  platform: ExportPlatform,
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

  const externalIds: string[] = [];
  for (const entry of item.source ?? []) {
    if (validatePlatformMapping(entry) !== null) continue;
    const mapping = entry as PlatformMapping;
    if (mapping.platform === platform && mapping.kind === "external_id") {
      externalIds.push(mapping.external_id);
    }
  }

  if (externalIds.length === 0) {
    return { canonical: null, alternatives: [], platformUnsupported: false, unknown: false };
  }

  const [canonical, ...alternatives] = externalIds;
  return { canonical, alternatives, platformUnsupported: false, unknown: false };
}
