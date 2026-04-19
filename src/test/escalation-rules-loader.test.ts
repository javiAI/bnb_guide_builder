import { describe, expect, it } from "vitest";
import { contactTypes } from "@/lib/taxonomy-loader";
import {
  escalationRules,
  findEscalationIntent,
  getEscalationFallback,
  getEscalationIntents,
} from "@/lib/taxonomy-loader";

describe("escalation_rules.json — boot validation", () => {
  it("parses and exposes intents + fallback", () => {
    expect(escalationRules.file).toBe("escalation_rules.json");
    expect(getEscalationIntents().length).toBeGreaterThan(0);
    const fallback = getEscalationFallback();
    expect(fallback.intentId).toMatch(/^int\./);
    expect(fallback.contactRoles.length).toBeGreaterThan(0);
  });

  it("every contact role referenced exists in contact_types.json", () => {
    const known = new Set(contactTypes.items.map((c) => c.id));
    for (const role of getEscalationFallback().contactRoles) {
      expect(known.has(role)).toBe(true);
    }
    for (const intent of getEscalationIntents()) {
      for (const role of intent.contactRoles) {
        expect(known.has(role)).toBe(true);
      }
    }
  });

  it("intent ids are unique", () => {
    const ids = getEscalationIntents().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fallback.intentId is a declared intent", () => {
    expect(findEscalationIntent(getEscalationFallback().intentId)).toBeDefined();
  });

  it("declares the 4 critical intents required by 11D", () => {
    for (const required of [
      "int.lockout",
      "int.emergency_medical",
      "int.emergency_fire",
      "int.general",
    ]) {
      expect(findEscalationIntent(required)).toBeDefined();
    }
  });

  it("each intent declares bilingual matchKeywords (es + en)", () => {
    for (const intent of getEscalationIntents()) {
      expect(intent.matchKeywords.es).toBeInstanceOf(Array);
      expect(intent.matchKeywords.en).toBeInstanceOf(Array);
    }
  });

  it("int.general declares no keywords (pure fallback bucket)", () => {
    const general = findEscalationIntent("int.general");
    expect(general).toBeDefined();
    expect(general!.matchKeywords.es.length).toBe(0);
    expect(general!.matchKeywords.en.length).toBe(0);
  });
});
