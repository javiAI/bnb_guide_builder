import type { LucideIcon } from "lucide-react";
import {
  Bug,
  Building2,
  Calculator,
  CarTaxiFront,
  ConciergeBell,
  Contact,
  Droplets,
  Flame,
  Globe,
  Headset,
  Hospital,
  House,
  Key,
  KeyRound,
  LifeBuoy,
  Lock,
  MapPinned,
  Microwave,
  PawPrint,
  Pill,
  Scale,
  Shield,
  Shirt,
  SprayCan,
  ThermometerSun,
  Trees,
  Umbrella,
  UserRound,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * Avatar glyph per contact type. Keys MUST match `taxonomies/contact_types.json`
 * item ids exactly — `contact-icon-coverage.test.ts` fails if they drift
 * (same contract as `access-icons.ts`). The avatar shows these icons for
 * non-person contacts (company / institution / platform); person contacts
 * show their initials instead (see `contacts/_components/contact-card.tsx`).
 */
export const CONTACT_TYPE_ICONS: Record<string, LucideIcon> = {
  // Operaciones
  "ct.host": UserRound,
  "ct.cohost": Users,
  "ct.property_manager": Building2,
  "ct.checkin_person": KeyRound,
  "ct.keyholder": Key,
  // Limpieza
  "ct.cleaning": SprayCan,
  "ct.laundry": Shirt,
  // Mantenimiento
  "ct.handyman": Wrench,
  "ct.plumber": Droplets,
  "ct.electrician": Zap,
  "ct.locksmith": Lock,
  "ct.hvac": ThermometerSun,
  "ct.appliance_repair": Microwave,
  "ct.pest_control": Bug,
  "ct.garden_pool": Trees,
  // Emergencias
  "ct.emergency_police": Shield,
  "ct.emergency_hospital": Hospital,
  "ct.emergency_fire": Flame,
  "ct.emergency_pharmacy": Pill,
  // Edificio
  "ct.building_manager": ConciergeBell,
  "ct.community_president": Users,
  "ct.neighbor": House,
  // Servicios
  "ct.transfer": CarTaxiFront,
  "ct.pet_service": PawPrint,
  "ct.tourism_board": MapPinned,
  // Administrativo
  "ct.insurance": Umbrella,
  "ct.legal": Scale,
  "ct.accountant": Calculator,
  // Plataformas
  "ct.platform_airbnb": LifeBuoy,
  "ct.platform_booking": Headset,
  "ct.platform_other": Globe,
  // Otro
  "ct.other": Contact,
};

/** Avatar tone per contact group. Drives the avatar background/foreground
 * (and the emergency card variant). Keys match `contact_types.json` group ids. */
export type ContactGroupTone = "primary" | "danger" | "success" | "neutral";

export const CONTACT_GROUP_TONE: Record<string, ContactGroupTone> = {
  "ctg.operations": "primary",
  "ctg.emergency": "danger",
  "ctg.cleaning": "success",
  "ctg.maintenance": "success",
  "ctg.building": "neutral",
  "ctg.services": "neutral",
  "ctg.admin": "neutral",
  "ctg.platforms": "neutral",
  "ctg.other": "neutral",
};

export function contactIconFor(roleKey: string): LucideIcon {
  return CONTACT_TYPE_ICONS[roleKey] ?? Contact;
}

export function contactGroupTone(groupId: string): ContactGroupTone {
  return CONTACT_GROUP_TONE[groupId] ?? "neutral";
}
