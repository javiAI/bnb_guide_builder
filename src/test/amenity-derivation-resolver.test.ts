import { describe, it, expect } from "vitest";
import { resolveDerivation, type DerivationContext } from "@/lib/amenity-derivation-resolver";
import type { AmenityItem } from "@/lib/types/taxonomy";

const propertyId = "prop-1";

function ctx(overrides: Partial<DerivationContext> = {}): DerivationContext {
  return {
    propertyId,
    systems: [],
    spaces: [],
    accessMethodsJson: null,
    ...overrides,
  };
}

function item(overrides: Partial<AmenityItem>): AmenityItem {
  return {
    id: "am.test",
    label: "Test",
    description: "desc",
    destination: "amenity_configurable",
    ...overrides,
  } as AmenityItem;
}

describe("resolveDerivation — derived_from_system", () => {
  it("is inactive when no system exists", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_system", target: "sys.internet" }),
      ctx(),
    );
    expect(status).not.toBeNull();
    expect(status!.isActive).toBe(false);
    expect(status!.sourceUrl).toBe(`/properties/${propertyId}/systems`);
  });

  it("is active when the target system is present", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_system", target: "sys.internet" }),
      ctx({ systems: [{ systemKey: "sys.internet", detailsJson: null }] }),
    );
    expect(status!.isActive).toBe(true);
  });

  it("extracts wifi SSID summary when sys.internet has it", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_system", target: "sys.internet" }),
      ctx({
        systems: [{ systemKey: "sys.internet", detailsJson: { ssid: "Mi Red 2.4" } }],
      }),
    );
    expect(status!.sourceSummary).toBe("Mi Red 2.4");
  });

  it("omits summary when ssid is empty", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_system", target: "sys.internet" }),
      ctx({
        systems: [{ systemKey: "sys.internet", detailsJson: { ssid: "   " } }],
      }),
    );
    expect(status!.sourceSummary).toBeNull();
  });

  it("returns null when target is missing", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_system", target: undefined }),
      ctx(),
    );
    expect(status).toBeNull();
  });
});

describe("resolveDerivation — derived_from_space", () => {
  it("is active when any space exists (no suggestedSpaceTypes constraint)", () => {
    // am.desk has no suggestedSpaceTypes — any space counts.
    const status = resolveDerivation(
      item({ id: "am.custom_space_item", destination: "derived_from_space" }),
      ctx({ spaces: [{ spaceType: "sp.bedroom" }] }),
    );
    expect(status!.isActive).toBe(true);
    expect(status!.sourceUrl).toBe(`/properties/${propertyId}/spaces`);
  });

  it("is inactive when there are no spaces", () => {
    const status = resolveDerivation(
      item({ id: "am.custom_space_item", destination: "derived_from_space" }),
      ctx({ spaces: [] }),
    );
    expect(status!.isActive).toBe(false);
  });
});

describe("resolveDerivation — derived_from_access", () => {
  it("is active when parking target matches", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_access", target: "pk.free_on_premises" }),
      ctx({ accessMethodsJson: { parkingTypes: ["pk.free_on_premises"] } }),
    );
    expect(status!.isActive).toBe(true);
    expect(status!.sourceUrl).toBe(`/properties/${propertyId}/access`);
    expect(status!.sourceLabel).toBe("Acceso");
  });

  it("is active when accessibility target matches", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_access", target: "ax.step_free_entry" }),
      ctx({ accessMethodsJson: { accessibilityFeatures: ["ax.step_free_entry"] } }),
    );
    expect(status!.isActive).toBe(true);
  });

  it("is inactive when target is not in either array", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_access", target: "pk.free_on_premises" }),
      ctx({ accessMethodsJson: { parkingTypes: ["pk.paid_on_premises"] } }),
    );
    expect(status!.isActive).toBe(false);
  });

  it("tolerates null accessMethodsJson", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_access", target: "pk.free_on_premises" }),
      ctx({ accessMethodsJson: null }),
    );
    expect(status!.isActive).toBe(false);
  });

  it("is inactive when target missing", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_access", target: undefined }),
      ctx({ accessMethodsJson: { parkingTypes: ["pk.free_on_premises"] } }),
    );
    expect(status!.isActive).toBe(false);
  });
});

describe("resolveDerivation — non-derived destinations", () => {
  it("returns null for amenity_configurable", () => {
    expect(
      resolveDerivation(item({ destination: "amenity_configurable" }), ctx()),
    ).toBeNull();
  });

  it("returns null for moved_to_* destinations", () => {
    expect(
      resolveDerivation(item({ destination: "moved_to_system" }), ctx()),
    ).toBeNull();
    expect(
      resolveDerivation(item({ destination: "moved_to_access" }), ctx()),
    ).toBeNull();
    expect(
      resolveDerivation(item({ destination: "moved_to_property_attribute" }), ctx()),
    ).toBeNull();
  });
});
