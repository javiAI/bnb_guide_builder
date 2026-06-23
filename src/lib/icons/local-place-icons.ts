import {
  Bus,
  CalendarDays,
  Car,
  Coffee,
  Drama,
  Dumbbell,
  GraduationCap,
  Handshake,
  Hospital,
  Image,
  Landmark,
  MapPin,
  Music,
  PartyPopper,
  Pill,
  Plane,
  ShoppingCart,
  TrainFront,
  Trees,
  Trophy,
  Umbrella,
  Users,
  Utensils,
  WashingMachine,
  Wine,
  type LucideIcon,
} from "lucide-react";

// Canonical taxonomy id → Lucide icon mappings for the local guide. Pinned by
// src/test/local-place-icon-coverage.test.ts against both taxonomy files.

export const LOCAL_PLACE_CATEGORY_ICONS: Record<string, LucideIcon> = {
  "lp.restaurant": Utensils,
  "lp.cafe": Coffee,
  "lp.bar": Wine,
  "lp.supermarket": ShoppingCart,
  "lp.pharmacy": Pill,
  "lp.hospital": Hospital,
  "lp.transport": TrainFront,
  "lp.parking": Car,
  "lp.arrival_train": TrainFront,
  "lp.arrival_bus": Bus,
  "lp.arrival_airport": Plane,
  "lp.attraction": Landmark,
  "lp.beach": Umbrella,
  "lp.park": Trees,
  "lp.gym": Dumbbell,
  "lp.laundry": WashingMachine,
  "lp.other": MapPin,
};

export function getLocalPlaceIcon(categoryKey: string): LucideIcon {
  return LOCAL_PLACE_CATEGORY_ICONS[categoryKey] ?? MapPin;
}

export const LOCAL_EVENT_CATEGORY_ICONS: Record<string, LucideIcon> = {
  "le.concert": Music,
  "le.sports": Trophy,
  "le.arts": Drama,
  "le.family": Users,
  "le.festival": PartyPopper,
  "le.exhibition": Image,
  "le.community": Handshake,
  "le.workshop": GraduationCap,
  "le.nightlife": Wine,
  "le.other": CalendarDays,
};

export function getLocalEventIcon(categoryKey: string): LucideIcon {
  return LOCAL_EVENT_CATEGORY_ICONS[categoryKey] ?? CalendarDays;
}
