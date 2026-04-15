import { describe, it, expect } from "vitest";
import {
  getGuideSectionConfigs,
  GUIDE_RESOLVER_KEYS,
} from "@/lib/taxonomy-loader";
import { getGuideResolverKeys } from "@/lib/services/guide-rendering.service";

describe("guide-sections coverage — integrity invariant", () => {
  it("every resolver declared in taxonomy has a resolver in the service", () => {
    const taxonomyKeys = new Set(getGuideSectionConfigs().map((s) => s.resolverKey));
    const serviceKeys = new Set(getGuideResolverKeys());
    for (const k of taxonomyKeys) {
      expect(serviceKeys.has(k)).toBe(true);
    }
  });

  it("no orphan resolvers: every resolver in the service is declared in taxonomy", () => {
    const taxonomyKeys = new Set(getGuideSectionConfigs().map((s) => s.resolverKey));
    const serviceKeys = getGuideResolverKeys();
    for (const k of serviceKeys) {
      expect(taxonomyKeys.has(k)).toBe(true);
    }
  });

  it("GUIDE_RESOLVER_KEYS and the service registry match exactly (order-insensitive)", () => {
    expect([...GUIDE_RESOLVER_KEYS].sort()).toEqual(
      [...getGuideResolverKeys()].sort(),
    );
  });
});
