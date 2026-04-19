import { describe, it, expect } from "vitest";
import { __internal } from "@/lib/services/assistant/intent-resolver";

const { parseClassifierOutput, HeuristicIntentResolver } = __internal;

describe("intent-resolver — classifier output parser", () => {
  it("parses clean JSON", () => {
    const res = parseClassifierOutput('{"journeyStage":"arrival","confidence":0.9}');
    expect(res).toEqual({ journeyStage: "arrival", confidence: 0.9 });
  });

  it("parses JSON embedded in prose", () => {
    const res = parseClassifierOutput(
      'Here is my answer: {"journeyStage":"stay","confidence":0.7} thanks',
    );
    expect(res).toEqual({ journeyStage: "stay", confidence: 0.7 });
  });

  it("rejects invalid stage names", () => {
    const res = parseClassifierOutput('{"journeyStage":"elsewhere","confidence":0.9}');
    expect(res).toBeNull();
  });

  it("clamps confidence to [0,1]", () => {
    expect(parseClassifierOutput('{"journeyStage":"stay","confidence":1.5}')).toEqual({
      journeyStage: "stay",
      confidence: 1,
    });
    expect(parseClassifierOutput('{"journeyStage":"stay","confidence":-0.2}')).toEqual({
      journeyStage: "stay",
      confidence: 0,
    });
  });

  it("returns null on non-JSON", () => {
    expect(parseClassifierOutput("I think it is stay")).toBeNull();
  });
});

describe("intent-resolver — heuristic fallback", () => {
  const resolver = new HeuristicIntentResolver();

  it("classifies check-in questions as arrival", async () => {
    const es = await resolver.resolve("¿Cómo hago el check-in?", "es");
    expect(es.journeyStage).toBe("arrival");
    expect(es.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("classifies wifi questions as stay", async () => {
    const en = await resolver.resolve("what is the wifi password?", "en");
    expect(en.journeyStage).toBe("stay");
  });

  it("classifies checkout questions as checkout", async () => {
    const en = await resolver.resolve("what time is checkout?", "en");
    expect(en.journeyStage).toBe("checkout");
  });

  it("returns 'any' with low confidence on unrelated questions", async () => {
    const out = await resolver.resolve("¿me cuentas un chiste?", "es");
    expect(out.journeyStage).toBe("any");
    expect(out.confidence).toBeLessThan(0.7);
  });
});
