import {
  BedDouble,
  ShowerHead,
  CookingPot,
  Sofa,
  Utensils,
  Briefcase,
  WashingMachine,
  Sun,
  Umbrella,
  Trees,
  Car,
  Boxes,
  House,
  Building2,
  LayoutGrid,
  Waves,
  UsersRound,
  DoorOpen,
  type LucideIcon,
} from "lucide-react";

/**
 * Canonical space-type → Lucide icon mapping for the operator spaces module.
 * Keys must match the IDs in `taxonomies/space_types.json` exactly — pinned by
 * `space-icon-coverage.test.ts` (mirrors the access-icons coverage pattern).
 * Used for the card cover placeholder (when a space has no photo) and the
 * space-type fact chip.
 */
export const SPACE_TYPE_ICONS: Record<string, LucideIcon> = {
  "sp.bedroom": BedDouble,
  "sp.bathroom": ShowerHead,
  "sp.kitchen": CookingPot,
  "sp.living_room": Sofa,
  "sp.dining": Utensils,
  "sp.office": Briefcase,
  "sp.laundry": WashingMachine,
  "sp.balcony": Sun,
  "sp.patio": Umbrella,
  "sp.garden": Trees,
  "sp.garage": Car,
  "sp.storage": Boxes,
  "sp.studio": House,
  "sp.loft": Building2,
  "sp.open_plan": LayoutGrid,
  "sp.kitchen_living": Sofa,
  "sp.kitchen_dining_living": Sofa,
  "sp.pool": Waves,
  "sp.shared_area": UsersRound,
  "sp.other": DoorOpen,
};

/** Resolves a space-type icon, falling back to a neutral room glyph. */
export function getSpaceIcon(spaceType: string): LucideIcon {
  return SPACE_TYPE_ICONS[spaceType] ?? DoorOpen;
}
