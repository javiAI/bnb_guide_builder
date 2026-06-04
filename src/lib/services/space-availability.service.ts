/**
 * Space availability resolver — layers propertyType + environment overlays
 * on top of the base (roomType) rule.
 *
 * Overlays can only PROMOTE optional → recommended. Required and excluded
 * lists stay untouched: those encode the base per-roomType requirements and are
 * not negotiable by context. The goal is purely UX: when a user creates a space,
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
  propertyType: string | null;
  /** A property can carry several environments (mountain + ski + …). */
  environments: string[];
}

function collectPromotions(
  propertyType: string | null,
  environments: string[],
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
  if (environments.length > 0) {
    for (const o of environmentOverlays) {
      if (environments.includes(o.environment)) {
        for (const id of o.promoteToRecommended) out.add(id);
      }
    }
  }
  return out;
}

export function resolveSpaceAvailability(
  input: ResolveSpaceAvailabilityInput,
): ResolvedSpaceAvailability {
  const base = getAvailableSpaceTypes(input.roomType);
  const promotions = collectPromotions(input.propertyType, input.environments);
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
