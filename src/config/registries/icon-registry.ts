/**
 * Icon registry.
 *
 * Maps stable taxonomy IDs and section keys to icon identifiers.
 * Components look up icons here instead of hardcoding them.
 *
 * To add an icon for a new amenity or section:
 * 1. Add the mapping in the relevant record below
 * 2. The UI will pick it up automatically
 *
 * Icon values are intentionally plain strings (emoji or icon-lib key)
 * to avoid coupling to a specific icon library. The rendering layer
 * resolves these to actual components.
 */

// ── Section icons (workspace sidebar) ──

export const SECTION_ICONS: Record<string, string> = {
  basics: "home",
  arrival: "key",
  policies: "shield",
  spaces: "layout",
  amenities: "coffee",
  troubleshooting: "alert-triangle",
  "local-guide": "map-pin",
  knowledge: "database",
  "guest-guide": "book-open",
  ai: "cpu",
  messaging: "message-circle",
  media: "image",
  ops: "clipboard",
  activity: "activity",
};

// ── Property type icons ──

export const PROPERTY_TYPE_ICONS: Record<string, string> = {
  "pt.apartment": "building",
  "pt.house": "home",
  "pt.villa": "sun",
  "pt.cabin": "tree",
  "pt.loft": "grid",
  "pt.studio": "square",
  "pt.townhouse": "columns",
  "pt.penthouse": "arrow-up",
  "pt.cottage": "cloud",
  "pt.bungalow": "umbrella",
};

// ── Access method icons ──

export const ACCESS_METHOD_ICONS: Record<string, string> = {
  "am.smart_lock": "smartphone",
  "am.keypad": "hash",
  "am.lockbox": "lock",
  "am.in_person": "user",
  "am.building_staff": "users",
  "am.key_handoff": "key",
};

// ── Amenity group icons ──

export const AMENITY_GROUP_ICONS: Record<string, string> = {
  "ag.essentials": "check-circle",
  "ag.climate": "thermometer",
  "ag.kitchen": "coffee",
  "ag.bathroom": "droplet",
  "ag.bedroom": "moon",
  "ag.entertainment": "tv",
  "ag.outdoor": "sun",
  "ag.safety": "shield",
  "ag.accessibility": "eye",
  "ag.family": "heart",
  "ag.work": "monitor",
  "ag.parking": "map-pin",
  "ag.laundry": "wind",
};

// ── Generic lookup ──

const ALL_REGISTRIES = [
  SECTION_ICONS,
  PROPERTY_TYPE_ICONS,
  ACCESS_METHOD_ICONS,
  AMENITY_GROUP_ICONS,
];

export function lookupIcon(id: string): string | undefined {
  for (const registry of ALL_REGISTRIES) {
    if (id in registry) return registry[id];
  }
  return undefined;
}
