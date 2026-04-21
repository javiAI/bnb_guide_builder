import { describe, it, expect } from "vitest";
import { MockPlacesProvider } from "@/lib/services/places/mock-provider";
import {
  PoiSuggestionSchema,
  type LocalPoiProvider,
} from "@/lib/services/places/provider";
import { isLocalPlaceCategoryKey } from "@/lib/taxonomy-loader";

// Every LocalPoiProvider implementation must satisfy this contract.
// Adding a new provider (e.g. GooglePlacesProvider in 13B+) = register it in
// `providerUnderTest` and rerun this suite. The MockPlacesProvider is a
// reference implementation — if it passes, the contract is coherent.

const providersUnderTest: Array<{ label: string; make: () => LocalPoiProvider }> = [
  { label: "MockPlacesProvider", make: () => new MockPlacesProvider() },
];

const ANCHOR = { latitude: 41.385, longitude: 2.173 };

for (const { label, make } of providersUnderTest) {
  describe(`LocalPoiProvider contract — ${label}`, () => {
    it("exposes a stable non-empty provider name", () => {
      const p = make();
      expect(typeof p.name).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);
    });

    it("returns an empty array for a blank query", async () => {
      const p = make();
      const result = await p.search({
        query: "   ",
        anchor: ANCHOR,
        language: "es",
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it("returns only valid `lp.*` category keys", async () => {
      const p = make();
      const result = await p.search({
        query: "restaurante",
        anchor: ANCHOR,
        language: "es",
      });
      for (const s of result) {
        expect(isLocalPlaceCategoryKey(s.categoryKey)).toBe(true);
        expect(PoiSuggestionSchema.safeParse(s).success).toBe(true);
      }
    });

    it("tags every suggestion with the provider's own name", async () => {
      const p = make();
      const result = await p.search({
        query: "café",
        anchor: ANCHOR,
        language: "es",
      });
      for (const s of result) {
        expect(s.provider).toBe(p.name);
      }
    });

    it("respects `limit` when provided", async () => {
      const p = make();
      const result = await p.search({
        query: "a", // broad match in mock seed
        anchor: ANCHOR,
        language: "es",
        limit: 2,
      });
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("stamps providerMetadata.retrievedAt as a valid ISO timestamp", async () => {
      const p = make();
      const result = await p.search({
        query: "restaurante",
        anchor: ANCHOR,
        language: "es",
      });
      for (const s of result) {
        const t = Date.parse(s.providerMetadata.retrievedAt);
        expect(Number.isFinite(t)).toBe(true);
      }
    });

    it("computes finite distanceMeters when returned", async () => {
      const p = make();
      const result = await p.search({
        query: "restaurante",
        anchor: ANCHOR,
        language: "es",
      });
      for (const s of result) {
        if (s.distanceMeters === undefined) continue;
        expect(Number.isFinite(s.distanceMeters)).toBe(true);
        expect(s.distanceMeters).toBeGreaterThanOrEqual(0);
      }
    });
  });
}
