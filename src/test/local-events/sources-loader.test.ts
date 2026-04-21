import { describe, it, expect } from "vitest";
import {
  localEventSources,
  findLocalEventSource,
} from "@/lib/taxonomy-loader";

describe("local_event_sources.json", () => {
  it("ships the bootstrap triad (Teruel, Albarracin, Valencia)", () => {
    const keys = new Set(localEventSources.items.map((s) => s.key));
    expect(keys.has("teruel_turismo")).toBe(true);
    expect(keys.has("albarracin_turismo")).toBe(true);
    expect(keys.has("valencia_turismo")).toBe(true);
  });

  it("has no duplicate keys", () => {
    const keys = localEventSources.items.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has valid URLs and geo bounds on every source", () => {
    for (const s of localEventSources.items) {
      expect(() => new URL(s.sourceUrl)).not.toThrow();
      expect(s.latitude).toBeGreaterThanOrEqual(-90);
      expect(s.latitude).toBeLessThanOrEqual(90);
      expect(s.longitude).toBeGreaterThanOrEqual(-180);
      expect(s.longitude).toBeLessThanOrEqual(180);
      expect(s.radiusKm).toBeGreaterThan(0);
      expect(s.radiusKm).toBeLessThanOrEqual(200);
    }
  });

  it("findLocalEventSource looks up by key", () => {
    expect(findLocalEventSource("teruel_turismo")?.city).toBe("Teruel");
    expect(findLocalEventSource("not-a-real-key")).toBeUndefined();
  });
});
