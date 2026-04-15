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

export interface DerivationContext {
  propertyId: string;
  systems: Array<{
    systemKey: string;
    detailsJson: unknown;
  }>;
  spaces: Array<{ spaceType: string }>;
  /** Flat snapshot of `Property.accessMethodsJson` — tolerant shape. */
  accessMethodsJson: {
    parkingTypes?: string[];
    accessibilityFeatures?: string[];
  } | null;
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
      // Presence is implied by a suitable space existing. Taxonomy uses
      // `suggestedSpaceTypes` in the scope policy to hint which space types
      // the amenity belongs to; if unset, any space counts.
      const scope = getAmenityScopePolicy(item.id);
      const suggested = scope?.suggestedSpaceTypes ?? [];
      const isActive = suggested.length === 0
        ? ctx.spaces.length > 0
        : ctx.spaces.some((s) => suggested.includes(s.spaceType));
      return {
        isActive,
        sourceLabel: "Espacios",
        sourceUrl: `${base}/spaces`,
        sourceSummary: null,
      };
    }

    case "derived_from_access": {
      const target = item.target;
      // Parking and accessibility keys live in distinct arrays; the `target`
      // field disambiguates. Fall back to `false` when target missing.
      const parking = ctx.accessMethodsJson?.parkingTypes ?? [];
      const access = ctx.accessMethodsJson?.accessibilityFeatures ?? [];
      const isActive = target
        ? parking.includes(target) || access.includes(target)
        : false;
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
