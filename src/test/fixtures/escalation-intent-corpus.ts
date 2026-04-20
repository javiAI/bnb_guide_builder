// Labeled corpus for the escalation intent precision gate (Rama 11D §4).
//
// Each row represents a real-shape guest question we want routed to a
// specific intent. The corpus is deliberately biased toward the 4 critical
// intents (lockout, medical, fire, general) because those are the ones
// that must hit ≥95% precision — getting them wrong is the failure mode
// the whole escalation layer exists to prevent (wrong number dialed in an
// emergency, or a host paged for a pure locksmith job).
//
// Add new rows as operators report mis-routings. Keywords go into
// `taxonomies/escalation_rules.json`; the corpus is the regression proof.

import type { EscalationIntentId } from "@/lib/taxonomy-loader";

export interface EscalationCorpusRow {
  question: string;
  language: "es" | "en";
  expectedIntent: EscalationIntentId;
  /** Optional synthesizer reason pooled into the matcher's haystack. */
  escalationReason?: string;
}

export const ESCALATION_CORPUS: ReadonlyArray<EscalationCorpusRow> = [
  // ── int.lockout (critical) ──
  { question: "me he quedado fuera del piso", language: "es", expectedIntent: "int.lockout" },
  { question: "perdí las llaves en el metro", language: "es", expectedIntent: "int.lockout" },
  { question: "no puedo entrar, la puerta está bloqueada", language: "es", expectedIntent: "int.lockout" },
  { question: "la cerradura esta rota, no cierra", language: "es", expectedIntent: "int.lockout" },
  { question: "no abre la puerta principal", language: "es", expectedIntent: "int.lockout" },
  { question: "I'm locked out, can you help?", language: "en", expectedIntent: "int.lockout" },
  { question: "lost my key earlier today", language: "en", expectedIntent: "int.lockout" },
  { question: "the door jammed and won't open", language: "en", expectedIntent: "int.lockout" },
  { question: "lock is stuck, key won't turn", language: "en", expectedIntent: "int.lockout" },
  { question: "cannot get in, been waiting outside", language: "en", expectedIntent: "int.lockout" },

  // ── int.emergency_medical (critical) ──
  { question: "emergencia médica, necesitamos ambulancia", language: "es", expectedIntent: "int.emergency_medical" },
  { question: "mi pareja no respira", language: "es", expectedIntent: "int.emergency_medical" },
  { question: "creo que ha tenido un infarto", language: "es", expectedIntent: "int.emergency_medical" },
  { question: "hay un herido sangrando en la cocina", language: "es", expectedIntent: "int.emergency_medical" },
  { question: "pérdida de conocimiento repentina", language: "es", expectedIntent: "int.emergency_medical" },
  { question: "medical emergency, call an ambulance", language: "en", expectedIntent: "int.emergency_medical" },
  { question: "possible heart attack, he's pale", language: "en", expectedIntent: "int.emergency_medical" },
  { question: "guest is not breathing", language: "en", expectedIntent: "int.emergency_medical" },
  { question: "bleeding heavily from a cut", language: "en", expectedIntent: "int.emergency_medical" },
  { question: "she is unconscious on the floor", language: "en", expectedIntent: "int.emergency_medical" },

  // ── int.emergency_fire (critical) ──
  { question: "hay un incendio en el edificio", language: "es", expectedIntent: "int.emergency_fire" },
  { question: "sale humo denso de la cocina", language: "es", expectedIntent: "int.emergency_fire" },
  { question: "veo llamas en la terraza del vecino", language: "es", expectedIntent: "int.emergency_fire" },
  { question: "se está quemando algo en el horno", language: "es", expectedIntent: "int.emergency_fire" },
  { question: "there is a fire in the kitchen", language: "en", expectedIntent: "int.emergency_fire" },
  { question: "heavy smoke coming from the hallway", language: "en", expectedIntent: "int.emergency_fire" },
  { question: "flames on the balcony next door", language: "en", expectedIntent: "int.emergency_fire" },

  // ── int.general (critical — fallback bucket) ──
  { question: "¿tenéis toallas extra?", language: "es", expectedIntent: "int.general" },
  { question: "¿cuál es la contraseña del wifi?", language: "es", expectedIntent: "int.general" },
  { question: "duda tonta sobre el check-out", language: "es", expectedIntent: "int.general" },
  { question: "¿dónde hay un restaurante cerca?", language: "es", expectedIntent: "int.general" },
  { question: "¿puedo dejar las maletas después del check-out?", language: "es", expectedIntent: "int.general" },
  { question: "do you have beach towels?", language: "en", expectedIntent: "int.general" },
  { question: "what is the wifi password?", language: "en", expectedIntent: "int.general" },
  { question: "silly question about checkout time", language: "en", expectedIntent: "int.general" },
  { question: "any good restaurant nearby?", language: "en", expectedIntent: "int.general" },
  { question: "can I leave the luggage after checkout?", language: "en", expectedIntent: "int.general" },

  // ── int.emergency_security (informational — not part of the critical gate) ──
  { question: "nos han robado, vuelvan rápido", language: "es", expectedIntent: "int.emergency_security" },
  { question: "hay un intruso en el apartamento", language: "es", expectedIntent: "int.emergency_security" },
  { question: "someone broke in last night", language: "en", expectedIntent: "int.emergency_security" },
  { question: "there is an intruder in the apartment", language: "en", expectedIntent: "int.emergency_security" },

  // ── int.maintenance_plumbing (informational) ──
  { question: "fuga de agua debajo del fregadero", language: "es", expectedIntent: "int.maintenance_plumbing" },
  { question: "se inunda el baño, sale agua", language: "es", expectedIntent: "int.maintenance_plumbing" },
  { question: "burst pipe under the sink", language: "en", expectedIntent: "int.maintenance_plumbing" },
  { question: "toilet is overflowing", language: "en", expectedIntent: "int.maintenance_plumbing" },

  // ── int.maintenance_electrical (informational) ──
  { question: "no hay luz en toda la casa", language: "es", expectedIntent: "int.maintenance_electrical" },
  { question: "saltó el diferencial otra vez", language: "es", expectedIntent: "int.maintenance_electrical" },
  { question: "breaker tripped and oven won't start", language: "en", expectedIntent: "int.maintenance_electrical" },
  { question: "power outage in the whole building", language: "en", expectedIntent: "int.maintenance_electrical" },
];

/** Intents for which precision must be ≥ PRECISION_THRESHOLD. Misrouting
 *  any of these has outsized user impact (emergency) or erodes trust
 *  (lockout, general). */
export const CRITICAL_INTENTS: ReadonlyArray<EscalationIntentId> = [
  "int.lockout",
  "int.emergency_medical",
  "int.emergency_fire",
  "int.general",
];

export const PRECISION_THRESHOLD = 0.95;
