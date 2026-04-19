import { describe, it, expect } from "vitest";
import { getGuideSectionConfigs } from "@/lib/taxonomy-loader";

// Invariant for the PWA (rama 10I): every section in `guide_sections.json`
// must declare an explicit `offlineCacheTier` (1, 2, or 3) so the service
// worker can route fetches deterministically. Tier 1 must include the four
// sections the spec L227 enumerates as critical-offline (Llegada, Wi-Fi,
// Ayuda, Salida → arrival, essentials, emergency, checkout). Adding a new
// section without picking a tier should fail at boot via the Zod schema in
// `taxonomy-loader.ts`; this suite asserts the same contract from outside.

describe("guide sections — offline cache tier", () => {
  it("declares offlineCacheTier on every section", () => {
    for (const s of getGuideSectionConfigs()) {
      expect([1, 2, 3], `section ${s.id} must declare tier ∈ {1,2,3}`).toContain(
        s.offlineCacheTier,
      );
    }
  });

  it("includes the four critical-offline sections in tier 1", () => {
    const tier1Ids = new Set(
      getGuideSectionConfigs()
        .filter((s) => s.offlineCacheTier === 1)
        .map((s) => s.id),
    );
    for (const id of [
      "gs.essentials",
      "gs.arrival",
      "gs.checkout",
      "gs.emergency",
    ]) {
      expect(tier1Ids, `tier 1 must include ${id}`).toContain(id);
    }
  });
});
