/**
 * Space availability resolver — layers propertyType + environment overlays
 * on top of the base (roomType + layoutKey) rule.
 *
 * Overlays can only PROMOTE optional → recommended. Required and excluded
 * lists stay untouched: those encode hard layout constraints and are not
 * negotiable by context. The goal is purely UX: when a user creates a space,
 * items that are "probably wanted for this kind of property" float up to the
 * recommended bucket so the selector surfaces them with the ★ marker.
 *
 * Kept separate from `computeSpaceAvailability` in property-derived.service
 * so the derived payload and completeness scoring keep running against the
 * base matrix — overlays are a presentation nudge, not a scoring input.
 */

import { spaceAvailabilityRules } from "@/lib/taxonomy-loader";
import { getAvailableSpaceTypes } from "@/lib/taxonomy-loader";

export interface ResolvedSpaceAvailability {
  required: string[];
  recommended: string[];
  optional: string[];
  excluded: string[];
}

export interface ResolveSpaceAvailabilityInput {
  roomType: string;
  layoutKey: string | null;
  propertyType: string | null;
  environment: string | null;
}

function collectPromotions(
  propertyType: string | null,
  environment: string | null,
): Set<string> {
  const out = new Set<string>();
  const { propertyTypeOverlays = [], environmentOverlays = [] } =
    spaceAvailabilityRules;

  if (propertyType) {
    for (const o of propertyTypeOverlays) {
      if (o.propertyType === propertyType) {
        for (const id of o.promoteToRecommended) out.add(id);
      }
    }
  }
  if (environment) {
    for (const o of environmentOverlays) {
      if (o.environment === environment) {
        for (const id of o.promoteToRecommended) out.add(id);
      }
    }
  }
  return out;
}

export function resolveSpaceAvailability(
  input: ResolveSpaceAvailabilityInput,
): ResolvedSpaceAvailability {
  const base = getAvailableSpaceTypes(input.roomType, input.layoutKey);
  const promotions = collectPromotions(input.propertyType, input.environment);
  if (promotions.size === 0) return base;

  const requiredSet = new Set(base.required);
  const recommendedSet = new Set(base.recommended);
  const excludedSet = new Set(base.excluded);

  // Only move from optional → recommended. Everything already required,
  // recommended, or excluded is left alone — the base matrix wins over
  // context-based suggestions.
  const optional: string[] = [];
  for (const id of base.optional) {
    if (promotions.has(id) && !requiredSet.has(id) && !excludedSet.has(id)) {
      recommendedSet.add(id);
    } else {
      optional.push(id);
    }
  }

  return {
    required: base.required,
    recommended: Array.from(recommendedSet),
    optional,
    excluded: base.excluded,
  };
}
