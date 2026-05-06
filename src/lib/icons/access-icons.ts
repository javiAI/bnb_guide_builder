import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  Anchor,
  Armchair,
  BedDouble,
  Bell,
  BellRing,
  Building2,
  CircleSlash,
  DoorClosed,
  DoorOpen,
  Droplets,
  Ellipsis,
  Footprints,
  GripHorizontal,
  Handshake,
  Key,
  KeyRound,
  KeySquare,
  LayoutGrid,
  LockKeyhole,
  MapPin,
  MoveHorizontal,
  ParkingMeter,
  ShowerHead,
  Smartphone,
  SquareParking,
  Toilet,
  UserRound,
  Warehouse,
} from "lucide-react";

export const ACCESS_COCKPIT_IDS = [
  "building",
  "unit",
  "parking",
  "accessibility",
] as const;
export type AccessCockpitId = (typeof ACCESS_COCKPIT_IDS)[number];

export const SUBSYSTEM_HEADER_ICONS: Record<AccessCockpitId, LucideIcon> = {
  building: Building2,
  unit: Key,
  parking: SquareParking,
  accessibility: Accessibility,
};

export const ACCESS_USAGE_KEYS: Record<AccessCockpitId, string> = {
  building: "access.building",
  unit: "access.unit",
  parking: "access.parking",
  accessibility: "access.accessibility",
};

export const BUILDING_ACCESS_ICONS: Record<string, LucideIcon> = {
  "ba.portal_code": KeyRound,
  "ba.access_link": Smartphone,
  "ba.intercom_auto": BellRing,
  "ba.lockbox": LockKeyhole,
  "ba.open_access": DoorOpen,
  "ba.intercom_host": Bell,
  "ba.reception": UserRound,
  "ba.key_pickup": MapPin,
  "ba.in_person": Handshake,
  "ba.other": Ellipsis,
};

export const UNIT_ACCESS_ICONS: Record<string, LucideIcon> = {
  "am.smart_lock": Smartphone,
  "am.keypad": KeySquare,
  "am.lockbox": LockKeyhole,
  "am.in_person": Handshake,
  "am.key_pickup": MapPin,
  "am.other": Ellipsis,
};

export const PARKING_ICONS: Record<string, LucideIcon> = {
  "pk.free_on_premises": Warehouse,
  "pk.free_street": MapPin,
  "pk.paid_on_premises": SquareParking,
  "pk.paid_off_premises": ParkingMeter,
  "pk.no_parking": CircleSlash,
  "pk.other": Ellipsis,
};

export const ACCESSIBILITY_ICONS: Record<string, LucideIcon> = {
  "ax.single_level_home": LayoutGrid,
  "ax.step_free_guest_entrance": DoorOpen,
  "ax.guest_entrance_wide_81cm": MoveHorizontal,
  "ax.step_free_path_to_entrance": Footprints,
  "ax.accessible_parking_spot": SquareParking,
  "ax.step_free_bedroom_access": BedDouble,
  "ax.bedroom_entrance_wide_81cm": DoorClosed,
  "ax.step_free_bathroom_access": ShowerHead,
  "ax.bathroom_entrance_wide_81cm": MoveHorizontal,
  "ax.step_free_shower": Droplets,
  "ax.shower_grab_bar": GripHorizontal,
  "ax.toilet_grab_bar": Toilet,
  "ax.shower_bath_chair": Armchair,
  "ax.ceiling_mobile_hoist": Anchor,
  "ax.other": Ellipsis,
};

export function buildingIconFor(id: string): LucideIcon {
  return BUILDING_ACCESS_ICONS[id] ?? Ellipsis;
}

export function unitIconFor(id: string): LucideIcon {
  return UNIT_ACCESS_ICONS[id] ?? Ellipsis;
}

export function parkingIconFor(id: string): LucideIcon {
  return PARKING_ICONS[id] ?? Ellipsis;
}

export function accessibilityIconFor(id: string): LucideIcon {
  return ACCESSIBILITY_ICONS[id] ?? Ellipsis;
}
