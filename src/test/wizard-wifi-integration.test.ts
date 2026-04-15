import { describe, it, expect } from "vitest";
import { amenityTaxonomy } from "@/lib/taxonomy-loader";
import { resolveDerivation } from "@/lib/amenity-derivation-resolver";

/**
 * Contract test: the wizard persists wifi credentials to
 * `PropertySystem(sys.internet).detailsJson.ssid`, and the amenities page
 * derives am.wifi from that same system. This test locks the two endpoints
 * together so a rename/refactor on either side fails loudly instead of
 * silently producing a wifi badge that never lights up.
 */
describe("wizard wifi → am.wifi derivation", () => {
  it("am.wifi is derived_from_system with target sys.internet", () => {
    const wifi = amenityTaxonomy.items.find((it) => it.id === "am.wifi");
    expect(wifi).toBeDefined();
    expect(wifi!.destination).toBe("derived_from_system");
    expect(wifi!.target).toBe("sys.internet");
  });

  it("resolver activates am.wifi when sys.internet exists (wizard shape)", () => {
    const wifi = amenityTaxonomy.items.find((it) => it.id === "am.wifi")!;

    // This fixture mirrors exactly what wizard.actions.ts writes:
    //   await tx.propertySystem.create({
    //     data: { systemKey: "sys.internet", detailsJson: { ssid, password } }
    //   })
    const status = resolveDerivation(wifi, {
      propertyId: "prop-test",
      systems: [
        { systemKey: "sys.internet", detailsJson: { ssid: "MiRed_5G", password: "secret" } },
      ],
      spaces: [],
      accessMethodsJson: null,
    });

    expect(status).not.toBeNull();
    expect(status!.isActive).toBe(true);
    expect(status!.sourceSummary).toBe("MiRed_5G");
    expect(status!.sourceUrl).toBe("/properties/prop-test/systems");
  });

  it("resolver deactivates am.wifi when sys.internet is absent", () => {
    const wifi = amenityTaxonomy.items.find((it) => it.id === "am.wifi")!;
    const status = resolveDerivation(wifi, {
      propertyId: "prop-test",
      systems: [],
      spaces: [],
      accessMethodsJson: null,
    });
    expect(status!.isActive).toBe(false);
  });
});
