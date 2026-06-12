import {
  Baby,
  BedDouble,
  BedSingle,
  CalendarClock,
  CircleParking,
  KeyRound,
  ShowerHead,
  ThermometerSun,
  Volume2,
  WifiOff,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Canonical playbook-type → Lucide icon mapping. Pinned by
// src/test/troubleshooting-icon-coverage.test.ts against the taxonomy ids.
export const TROUBLESHOOTING_TYPE_ICONS: Record<string, LucideIcon> = {
  "tr.lockout": KeyRound,
  "tr.wifi_down": WifiOff,
  "tr.power_outage": Zap,
  "tr.no_hot_water": ShowerHead,
  "tr.hvac_issue": ThermometerSun,
  "tr.noise_complaint": Volume2,
  "tr.parking_question": CircleParking,
  "tr.checkin_time_change": CalendarClock,
  "tr.bed_preference": BedDouble,
  "tr.extra_crib": Baby,
  "tr.extra_bed": BedSingle,
};

export function getTroubleshootingIcon(playbookKey: string): LucideIcon {
  return TROUBLESHOOTING_TYPE_ICONS[playbookKey] ?? Wrench;
}
