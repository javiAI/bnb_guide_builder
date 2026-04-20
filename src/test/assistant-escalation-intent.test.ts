import { describe, expect, it } from "vitest";
import {
  resolveEscalationIntent,
  __internal,
} from "@/lib/services/assistant/escalation-intent";

const { CONFIDENCE } = __internal;

describe("resolveEscalationIntent — int.lockout", () => {
  it.each([
    ["no puedo entrar en el piso"],
    ["perdí la llave"],
    ["perdí las llaves y estoy en la calle"],
    ["me he quedado fuera, ¿qué hago?"],
    ["la cerradura está rota"],
    ["la cerradura está atascada"],
    ["no abre la puerta principal"],
    ["puerta bloqueada desde fuera"],
  ])("es: routes %j → int.lockout", (question) => {
    const r = resolveEscalationIntent({ question, language: "es" });
    expect(r.intentId).toBe("int.lockout");
    expect(r.confidence).toBe(CONFIDENCE.nonEmergency);
    expect(r.matchedKeyword).not.toBeNull();
  });

  it.each([
    ["I'm locked out"],
    ["can't get in"],
    ["I lost my key"],
    ["lost the keys"],
    ["door jammed, won't open"],
    ["the lock is stuck"],
    ["broken lock on the front door"],
  ])("en: routes %j → int.lockout", (question) => {
    const r = resolveEscalationIntent({ question, language: "en" });
    expect(r.intentId).toBe("int.lockout");
    expect(r.confidence).toBe(CONFIDENCE.nonEmergency);
  });
});

describe("resolveEscalationIntent — int.emergency_medical", () => {
  it.each([
    ["necesito una ambulancia urgente"],
    ["es una emergencia médica"],
    ["hay un herido sangrando"],
    ["sangra mucho, no para"],
    ["pérdida de conocimiento"],
    ["creo que es un infarto"],
    ["no respira, ¡ayuda!"],
  ])("es: routes %j → int.emergency_medical (emergency)", (question) => {
    const r = resolveEscalationIntent({ question, language: "es" });
    expect(r.intentId).toBe("int.emergency_medical");
    expect(r.confidence).toBe(CONFIDENCE.emergency);
  });

  it.each([
    ["medical emergency, we need an ambulance"],
    ["someone is bleeding heavily"],
    ["he is unconscious"],
    ["looks like a heart attack"],
    ["not breathing"],
  ])("en: routes %j → int.emergency_medical (emergency)", (question) => {
    const r = resolveEscalationIntent({ question, language: "en" });
    expect(r.intentId).toBe("int.emergency_medical");
    expect(r.confidence).toBe(CONFIDENCE.emergency);
  });

  it("accent-insensitive: 'medica' matches 'médica'", () => {
    const r = resolveEscalationIntent({
      question: "emergencia medica urgente",
      language: "es",
    });
    expect(r.intentId).toBe("int.emergency_medical");
  });

  it("word-boundary: 'hospital' keyword must not match 'hospitality' in a question", () => {
    const r = resolveEscalationIntent({
      question: "I work in hospitality and have a question about check-in",
      language: "en",
    });
    // Should fall through to general; before the word-boundary fix this
    // routed to int.emergency_medical because "hospital" is a substring of
    // "hospitality".
    expect(r.intentId).toBe("int.general");
  });

  it("word-boundary: Spanish 'robo' must not match 'robótica'", () => {
    const r = resolveEscalationIntent({
      question: "hay un curso de robotica en la zona",
      language: "es",
    });
    expect(r.intentId).toBe("int.general");
  });
});

describe("resolveEscalationIntent — int.emergency_fire", () => {
  it.each([
    ["hay un incendio en la cocina"],
    ["sale humo denso del baño"],
    ["veo llamas en la terraza"],
    ["se está quemando algo"],
  ])("es: routes %j → int.emergency_fire (emergency)", (question) => {
    const r = resolveEscalationIntent({ question, language: "es" });
    expect(r.intentId).toBe("int.emergency_fire");
    expect(r.confidence).toBe(CONFIDENCE.emergency);
  });

  it.each([
    ["there is a fire in the kitchen"],
    ["heavy smoke coming from the bathroom"],
    ["flames on the balcony"],
    ["something is burning"],
  ])("en: routes %j → int.emergency_fire (emergency)", (question) => {
    const r = resolveEscalationIntent({ question, language: "en" });
    expect(r.intentId).toBe("int.emergency_fire");
    expect(r.confidence).toBe(CONFIDENCE.emergency);
  });
});

describe("resolveEscalationIntent — int.general (fallback)", () => {
  it.each([
    ["¿tenéis toallas de playa?"],
    ["¿dónde puedo aparcar la bici?"],
    ["hola, una duda tonta"],
    [""],
  ])("es: out-of-scope %j falls back to int.general with low confidence", (question) => {
    const r = resolveEscalationIntent({ question, language: "es" });
    expect(r.intentId).toBe("int.general");
    expect(r.confidence).toBe(CONFIDENCE.fallback);
    expect(r.matchedKeyword).toBeNull();
  });

  it.each([
    ["do you have beach towels?"],
    ["just a silly question about the area"],
    ["hi, quick question"],
  ])("en: out-of-scope %j falls back to int.general", (question) => {
    const r = resolveEscalationIntent({ question, language: "en" });
    expect(r.intentId).toBe("int.general");
    expect(r.confidence).toBe(CONFIDENCE.fallback);
  });
});

describe("resolveEscalationIntent — precedence rules", () => {
  it("emergency beats non-emergency when both match", () => {
    // Contains both 'fuga de agua' (int.maintenance_plumbing, non-emergency)
    // AND 'no respira' (int.emergency_medical, emergency)
    const r = resolveEscalationIntent({
      question: "hay fuga de agua y el abuelo no respira",
      language: "es",
    });
    expect(r.intentId).toBe("int.emergency_medical");
    expect(r.confidence).toBe(CONFIDENCE.emergency);
  });

  it("longest keyword wins within same priority tier", () => {
    // 'hospital' (medical) vs 'heart attack' (medical, longer) — both medical;
    // verifies the longest-match tiebreak surfaces the more specific keyword.
    const r = resolveEscalationIntent({
      question: "near the hospital, possible heart attack",
      language: "en",
    });
    expect(r.intentId).toBe("int.emergency_medical");
    expect(r.matchedKeyword).toBe("heart attack");
  });

  it("escalationReason contributes to matching when question is vague", () => {
    const r = resolveEscalationIntent({
      question: "ayuda por favor",
      language: "es",
      escalationReason: "el huésped reporta que no puede entrar",
    });
    expect(r.intentId).toBe("int.lockout");
  });
});

describe("resolveEscalationIntent — maintenance intents", () => {
  it("routes water leak to int.maintenance_plumbing (es)", () => {
    const r = resolveEscalationIntent({
      question: "fuga de agua debajo del fregadero",
      language: "es",
    });
    expect(r.intentId).toBe("int.maintenance_plumbing");
    expect(r.confidence).toBe(CONFIDENCE.nonEmergency);
  });

  it("routes power outage to int.maintenance_electrical (en)", () => {
    const r = resolveEscalationIntent({
      question: "we have no power in the apartment",
      language: "en",
    });
    expect(r.intentId).toBe("int.maintenance_electrical");
    expect(r.confidence).toBe(CONFIDENCE.nonEmergency);
  });

  it("routes tripped breaker to int.maintenance_electrical (en)", () => {
    const r = resolveEscalationIntent({
      question: "the breaker tripped and the oven is off",
      language: "en",
    });
    expect(r.intentId).toBe("int.maintenance_electrical");
  });
});

describe("resolveEscalationIntent — security intents", () => {
  it("routes robbery to int.emergency_security (es)", () => {
    const r = resolveEscalationIntent({
      question: "nos han robado en el apartamento",
      language: "es",
    });
    expect(r.intentId).toBe("int.emergency_security");
    expect(r.confidence).toBe(CONFIDENCE.emergency);
  });

  it("routes intruder to int.emergency_security (en)", () => {
    const r = resolveEscalationIntent({
      question: "there is an intruder in the apartment",
      language: "en",
    });
    expect(r.intentId).toBe("int.emergency_security");
  });
});

describe("resolveEscalationIntent — language scoping", () => {
  it("does not match EN keywords when language is es", () => {
    // 'locked out' is an EN keyword for int.lockout. In Spanish context
    // it should NOT hit — the guest would have typed the Spanish phrase.
    const r = resolveEscalationIntent({
      question: "locked out",
      language: "es",
    });
    expect(r.intentId).toBe("int.general");
  });

  it("does not match ES keywords when language is en", () => {
    const r = resolveEscalationIntent({
      question: "perdí la llave",
      language: "en",
    });
    expect(r.intentId).toBe("int.general");
  });
});
