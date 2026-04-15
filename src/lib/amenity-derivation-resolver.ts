/**
 * Resolves the current state of a derived amenity (derived_from_space |
 * derived_from_system | derived_from_access) by looking at the authoritative
 * source of truth for each category. The amenity taxonomy declares
 * `destination` + optional `target`; this module consumes those to produce
 * the label/url/summary tuple the UI needs for the read-only badge.
 */

import {
  findSystemItem,
  getAmenityScopePolicy,
} from "./taxonomy-loader";
import type { AmenityItem } from "./types/taxonomy";

/**
 * Shape of `Property.accessMethodsJson` as persisted by the Access page
 * (see editor.actions.ts saveAccessAction). Tolerant — every level is
 * optional because legacy / in-progress rows may be partial.
 */
export interface AccessMethodsShape {
  building?: { methods?: string[] } | null;
  unit?: { methods?: string[] } | null;
  parking?: { types?: string[] } | null;
  accessibility?: { features?: string[] } | null;
}

export interface DerivationContext {
  propertyId: string;
  systems: Array<{
    systemKey: string;
    detailsJson: unknown;
  }>;
  spaces: Array<{ spaceType: string }>;
  accessMethodsJson: AccessMethodsShape | null;
}

export interface DerivationStatus {
  isActive: boolean;
  sourceLabel: string;
  sourceUrl: string;
  /** Optional human-readable summary, e.g. the wifi SSID. */
  sourceSummary: string | null;
}

function firstStringField(
  detailsJson: unknown,
  candidates: string[],
): string | null {
  if (!detailsJson || typeof detailsJson !== "object") return null;
  const obj = detailsJson as Record<string, unknown>;
  for (const key of candidates) {
    const v = obj[key];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

/** `|`-separated target ids, e.g. "sp.studio|sp.loft". Returns [] when empty. */
function splitTarget(target: string | undefined): string[] {
  if (!target) return [];
  return target.split("|").map((s) => s.trim()).filter((s) => s.length > 0);
}

export function resolveDerivation(
  item: AmenityItem,
  ctx: DerivationContext,
): DerivationStatus | null {
  const base = `/properties/${ctx.propertyId}`;

  switch (item.destination) {
    case "derived_from_system": {
      const target = item.target;
      if (!target) return null;
      const system = ctx.systems.find((s) => s.systemKey === target);
      const systemItem = findSystemItem(target);
      const sourceLabel = systemItem?.label ?? "Sistemas";
      // Surface a short summary when the system declares easily-read fields.
      // Currently we only pick SSID for wifi; other systems just signal presence.
      const summary = system && target === "sys.internet"
        ? firstStringField(system.detailsJson, ["ssid"])
        : null;
      return {
        isActive: !!system,
        sourceLabel,
        sourceUrl: `${base}/systems`,
        sourceSummary: summary,
      };
    }

    case "derived_from_space": {
      // Active when the property has a space whose type is one of the
      // relevant space types. Priority:
      //   1. scopePolicy.suggestedSpaceTypes (fine-grained)
      //   2. item.target (may encode "sp.a|sp.b" — taxonomy convention for
      //      amenities like am.backyard → sp.garden, am.kitchenette →
      //      sp.studio|sp.loft)
      //   3. no constraint → any space counts (only for items where
      //      suggestedSpaceTypes and target are both empty)
      const scope = getAmenityScopePolicy(item.id);
      const suggested = scope?.suggestedSpaceTypes ?? [];
      const targetSpaceTypes = splitTarget(item.target);
      const relevantTypes = suggested.length > 0 ? suggested : targetSpaceTypes;
      const isActive = relevantTypes.length === 0
        ? ctx.spaces.length > 0
        : ctx.spaces.some((s) => relevantTypes.includes(s.spaceType));
      return {
        isActive,
        sourceLabel: "Espacios",
        sourceUrl: `${base}/spaces`,
        sourceSummary: null,
      };
    }

    case "derived_from_access": {
      const target = item.target;
      const parkingTypes = ctx.accessMethodsJson?.parking?.types ?? [];
      const accessibilityFeatures = ctx.accessMethodsJson?.accessibility?.features ?? [];
      // Target semantics:
      //   - "parking_options" → active when ANY parking type is configured
      //     (matches the taxonomy convention used by am.free_parking)
      //   - "accessibility_features" → active when ANY a11y feature is set
      //   - concrete "pk.*" / "ax.*" id → exact inclusion check
      //   - empty → inactive (no way to resolve)
      let isActive = false;
      if (target === "parking_options") {
        isActive = parkingTypes.length > 0;
      } else if (target === "accessibility_features") {
        isActive = accessibilityFeatures.length > 0;
      } else if (target) {
        isActive = parkingTypes.includes(target) || accessibilityFeatures.includes(target);
      }
      return {
        isActive,
        sourceLabel: "Acceso",
        sourceUrl: `${base}/access`,
        sourceSummary: null,
      };
    }

    default:
      return null;
  }
}
