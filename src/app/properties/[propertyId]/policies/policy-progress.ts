import type { PoliciesData } from "@/lib/schemas/editor.schema";

/**
 * The fixed set of house rules surfaced as a count in the page header. Normas is
 * a closed catalogue (8 taxonomy-defined decisions), not a collection — so the
 * status is "X de 8 definidas" rather than a per-card pill. The defaults are real
 * decisions (exportable to OTAs), so a virgin property reads "8 de 8 definidas".
 */
export const POLICY_RULE_COUNT = 8;

/**
 * The unmet completeness signals for the live policies state, as the exact
 * operator-facing labels shown in the header chip's hover (`Falta: …`). A rule
 * is "definida" unless the chosen branch emits a signal here; the count of rules
 * with ≥1 signal is subtracted from 8 for the header. Pure (no React) so it can
 * be unit-tested and run identically server/client.
 *
 * Note: each label is a *contract* — the hover copy is asserted in
 * policy-progress.test.ts. One label per affected rule (a rule never emits two).
 */
export function policyMissingSignals(data: PoliciesData): string[] {
  const missing: string[] = [];

  // Fumar — zona designada sin describir dónde.
  if (data.smoking === "designated_area" && !data.smokingArea?.trim()) {
    missing.push("zona de fumadores");
  }

  // Eventos — con aprobación sin instrucciones.
  if (data.events.policy === "with_approval" && !data.events.approvalInstructions?.trim()) {
    missing.push("instrucciones de aprobación de eventos");
  }

  // Mascotas — admitidas sin tipos / sin importe del suplemento.
  if (data.pets.allowed) {
    if ((data.pets.types ?? []).length === 0) {
      missing.push("tipos de mascota");
    }
    if (data.pets.feeMode && data.pets.feeMode !== "none" && !((data.pets.feeAmount ?? 0) > 0)) {
      missing.push("importe del suplemento de mascotas");
    }
  }

  // Limpieza — suplemento activado sin importe.
  if (data.supplements.cleaning.enabled && !((data.supplements.cleaning.amount ?? 0) > 0)) {
    missing.push("importe de limpieza");
  }

  // Huésped extra — suplemento activado sin importe.
  if (data.supplements.extraGuest.enabled && !((data.supplements.extraGuest.amount ?? 0) > 0)) {
    missing.push("importe por huésped extra");
  }

  // Servicios externos — permitidos sin tipos.
  if (data.services.allowed && (data.services.types ?? []).length === 0) {
    missing.push("tipos de servicio");
  }

  return missing;
}

// ── Time slots (30-min granularity) — the canonical control for quiet hours,
// replacing the 48-option <select>. A slot is 0–47; slot 0 = "00:00", slot 44 =
// "22:00". Pure round-trip helpers, unit-tested across all 48 slots. ──

export const TIME_SLOT_COUNT = 48;

export function slotToHHMM(slot: number): string {
  const s = ((slot % TIME_SLOT_COUNT) + TIME_SLOT_COUNT) % TIME_SLOT_COUNT;
  const h = String(Math.floor(s / 2)).padStart(2, "0");
  const m = s % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
}

export function hhmmToSlot(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return 0;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const slot = hours * 2 + (minutes >= 30 ? 1 : 0);
  return ((slot % TIME_SLOT_COUNT) + TIME_SLOT_COUNT) % TIME_SLOT_COUNT;
}
