import type { LucideIcon } from "lucide-react";
import {
  AlarmSmoke,
  Bell,
  BriefcaseMedical,
  Cctv,
  Droplets,
  Fan,
  Filter,
  FireExtinguisher,
  Flame,
  Fuel,
  Gauge,
  MoveVertical,
  Siren,
  Snowflake,
  Sun,
  Trash2,
  Tv,
  Waves,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * Canonical taxonomy ID → Lucide icon mapping for property systems.
 *
 * Keys must match `system_taxonomy.json` item ids exactly (sys.*) — enforced
 * by `src/test/system-icon-coverage.test.ts`. Mirrors the per-record pattern
 * of `access-icons.ts`; there is no global Lucide allowlist (icon policy is
 * verified per-surface via local coverage tests).
 *
 * Icon choices documented where a system has no obvious 1:1 Lucide glyph:
 *   - sys.co_detector → Gauge (CO detector reads a gas level; no dedicated glyph).
 *   - sys.gas → Fuel (gas supply; Flame is reserved for heating).
 *   - sys.elevator → MoveVertical (Lucide ships no elevator glyph; vertical travel).
 *   - sys.hot_water → Droplets (Flame reserved for heating/boiler heat).
 */
export const SYSTEM_ICONS: Record<string, LucideIcon> = {
  // Conectividad
  "sys.internet": Wifi,
  "sys.cable_tv": Tv,
  // Climatización
  "sys.heating": Flame,
  "sys.cooling": Snowflake,
  "sys.ventilation": Fan,
  // Agua
  "sys.hot_water": Droplets,
  "sys.water_filter": Filter,
  // Seguridad
  "sys.alarm": Siren,
  "sys.cctv": Cctv,
  "sys.intercom": Bell,
  // Seguridad doméstica
  "sys.smoke_detector": AlarmSmoke,
  "sys.co_detector": Gauge,
  "sys.fire_extinguisher": FireExtinguisher,
  "sys.first_aid_kit": BriefcaseMedical,
  // Energía
  "sys.electricity": Zap,
  "sys.gas": Fuel,
  "sys.solar": Sun,
  // Edificio
  "sys.elevator": MoveVertical,
  "sys.garbage": Trash2,
  "sys.pool_maintenance": Waves,
};

/** Fallback icon for unknown/legacy system keys (defensive, never hit in CI). */
export const SYSTEM_FALLBACK_ICON: LucideIcon = Wrench;

export function systemIconFor(systemKey: string): LucideIcon {
  return SYSTEM_ICONS[systemKey] ?? SYSTEM_FALLBACK_ICON;
}
