/**
 * Cross-validations — pure functions that inspect a hydrated property and
 * return findings with severity:
 *   - `blocker`: must be fixed before publishing any guest-facing output
 *   - `error`:   data leak / correctness; fix before anything reads this
 *   - `warning`: likely data-entry mistake; surface to the user but don't block
 *
 * These are intentionally pure + pass-in-data (no Prisma import) so they are
 * cheap to unit test. The orchestrator (`run-all.ts`) loads the property and
 * passes it in.
 */

import { findSubtype } from "@/lib/taxonomy-loader";
import { getBedSleepingCapacity } from "@/lib/property-counts";

export type ValidationSeverity = "blocker" | "error" | "warning";

export interface ValidationFinding {
  /** Stable id for dedupe/filter (e.g. "wifi_incomplete"). */
  id: string;
  severity: ValidationSeverity;
  message: string;
  /** Optional deep-link to the section the user should fix. */
  ctaUrl?: string;
  ctaLabel?: string;
}

export interface ValidationContext {
  propertyId: string;
  maxGuests: number | null;
  infantsAllowed: boolean;
  accessMethodsJson: {
    building?: { methods?: string[] } | null;
    unit?: { methods?: string[] } | null;
  } | null;
  systems: Array<{
    systemKey: string;
    detailsJson: unknown;
    visibility: string;
  }>;
  amenityInstances: Array<{
    amenityKey: string;
    subtypeKey: string | null;
    detailsJson: unknown;
    visibility: string;
  }>;
  /** Pre-aggregated from BedConfiguration rows. */
  beds: Array<{
    bedType: string;
    quantity: number;
    configJson: Record<string, unknown> | null;
  }>;
}

const SMART_LOCK_KEYS = new Set([
  "am.smart_lock",
  "am.keypad",
  "am.digital_key",
]);

/**
 * Wifi is a derived amenity: activated by PropertySystem(sys.internet). If the
 * system exists but details are missing ssid/password, the wifi badge lights up
 * with nothing to show — block publishing.
 */
export function validateWifiComplete(ctx: ValidationContext): ValidationFinding[] {
  const internet = ctx.systems.find((s) => s.systemKey === "sys.internet");
  if (!internet) return [];
  const details = (internet.detailsJson ?? {}) as Record<string, unknown>;
  const ssid = typeof details.ssid === "string" ? details.ssid.trim() : "";
  const password = typeof details.password === "string" ? details.password.trim() : "";
  if (ssid && password) return [];

  const missing: string[] = [];
  if (!ssid) missing.push("SSID");
  if (!password) missing.push("contraseña");

  return [
    {
      id: "wifi_incomplete",
      severity: "blocker",
      message: `Wifi configurado sin ${missing.join(" ni ")}. El huésped no podrá conectarse.`,
      ctaUrl: `/properties/${ctx.propertyId}/systems`,
      ctaLabel: "Completar wifi",
    },
  ];
}

/**
 * A smart lock / keypad without a backup access method is a single point of
 * failure (dead battery, flat phone). Require at least one non-digital backup
 * in `unit.methods`.
 */
export function validateSmartLockBackup(ctx: ValidationContext): ValidationFinding[] {
  const methods = ctx.accessMethodsJson?.unit?.methods ?? [];
  const digitalPrimary = methods.filter((m) => SMART_LOCK_KEYS.has(m));
  if (digitalPrimary.length === 0) return [];
  const hasBackup = methods.some((m) => !SMART_LOCK_KEYS.has(m));
  if (hasBackup) return [];

  return [
    {
      id: "smart_lock_no_backup",
      severity: "blocker",
      message:
        "Cerradura digital sin método de acceso alternativo. Si falla la batería o la app, el huésped se queda fuera.",
      ctaUrl: `/properties/${ctx.propertyId}/access`,
      ctaLabel: "Añadir backup",
    },
  ];
}

/**
 * `maxGuests` should not exceed the sleeping capacity derived from
 * BedConfiguration. If it does, the listing promises more than the beds can
 * sleep — warning (not blocker; some hosts intentionally allow sofa use).
 */
export function validateCapacityCoherence(
  ctx: ValidationContext,
): ValidationFinding[] {
  if (ctx.maxGuests == null) return [];
  const sleeping = ctx.beds.reduce(
    (sum, b) => sum + getBedSleepingCapacity(b.bedType, b.quantity, b.configJson),
    0,
  );
  if (sleeping === 0) return [];
  if (ctx.maxGuests <= sleeping) return [];

  return [
    {
      id: "capacity_exceeds_beds",
      severity: "warning",
      message: `maxGuests=${ctx.maxGuests} supera la capacidad de camas (${sleeping}). Revisa la configuración de camas o reduce el aforo.`,
      ctaUrl: `/properties/${ctx.propertyId}/spaces`,
      ctaLabel: "Revisar camas",
    },
  ];
}

/**
 * A crib (am.crib) implies infants are welcome. If `infantsAllowed` is false,
 * the data contradicts itself.
 */
export function validateInfantsVsCrib(
  ctx: ValidationContext,
): ValidationFinding[] {
  if (ctx.infantsAllowed) return [];
  const hasCrib = ctx.amenityInstances.some((a) => a.amenityKey === "am.crib");
  if (!hasCrib) return [];
  return [
    {
      id: "infants_vs_crib",
      severity: "warning",
      message:
        "Cuna (am.crib) configurada pero la política marca que no se admiten bebés. Elige una de las dos.",
      ctaUrl: `/properties/${ctx.propertyId}/policies`,
      ctaLabel: "Revisar política",
    },
  ];
}

/**
 * Visibility leak: an amenity instance marked `visibility="public"` (or
 * `booked_guest`) must not contain detailsJson values for fields whose taxonomy
 * declaration says `visibility: "sensitive"`. If it does, the field would be
 * served to guests / the AI via the public retrieval path.
 */
export function validateVisibilityLeaks(
  ctx: ValidationContext,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  for (const inst of ctx.amenityInstances) {
    if (inst.visibility !== "public" && inst.visibility !== "booked_guest") continue;
    const subtype = inst.subtypeKey ? findSubtype(inst.subtypeKey) : undefined;
    if (!subtype) continue;
    const details = (inst.detailsJson ?? {}) as Record<string, unknown>;
    const leaked = subtype.fields
      .filter((f) => f.visibility === "sensitive")
      .filter((f) => {
        const v = details[f.id];
        return v !== undefined && v !== null && v !== "";
      })
      .map((f) => f.label);
    if (leaked.length === 0) continue;

    findings.push({
      id: `visibility_leak_${inst.amenityKey}`,
      severity: "error",
      message: `"${inst.amenityKey}" expone datos sensibles (${leaked.join(", ")}) con visibilidad ${inst.visibility}. Súbele la visibilidad o elimina esos campos.`,
      ctaUrl: `/properties/${ctx.propertyId}/amenities`,
      ctaLabel: "Revisar visibilidad",
    });
  }
  return findings;
}
