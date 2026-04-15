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

const baseItem = {
  id: "am.test",
  label: "Test",
  description: "desc",
  destination: "amenity_configurable",
} satisfies AmenityItem;

function item(overrides: Partial<AmenityItem> = {}): AmenityItem {
  return { ...baseItem, ...overrides };
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
  it("is active when any space exists (no constraint)", () => {
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

  it("uses target when suggestedSpaceTypes is empty (am.backyard → sp.garden)", () => {
    // am.backyard is a real taxonomy item with target "sp.garden" and
    // empty suggestedSpaceTypes — its badge must only activate when the
    // property has a garden space.
    const backyard = item({
      id: "am.backyard",
      destination: "derived_from_space",
      target: "sp.garden",
    });

    const withGarden = resolveDerivation(
      backyard,
      ctx({ spaces: [{ spaceType: "sp.garden" }] }),
    );
    expect(withGarden!.isActive).toBe(true);

    const withoutGarden = resolveDerivation(
      backyard,
      ctx({ spaces: [{ spaceType: "sp.bedroom" }] }),
    );
    expect(withoutGarden!.isActive).toBe(false);
  });

  it("parses |-separated target (am.patio_balcony → sp.balcony|sp.patio)", () => {
    const patioBalcony = item({
      id: "am.patio_balcony",
      destination: "derived_from_space",
      target: "sp.balcony|sp.patio",
    });

    const withBalcony = resolveDerivation(
      patioBalcony,
      ctx({ spaces: [{ spaceType: "sp.balcony" }] }),
    );
    expect(withBalcony!.isActive).toBe(true);

    const withPatio = resolveDerivation(
      patioBalcony,
      ctx({ spaces: [{ spaceType: "sp.patio" }] }),
    );
    expect(withPatio!.isActive).toBe(true);

    const withNeither = resolveDerivation(
      patioBalcony,
      ctx({ spaces: [{ spaceType: "sp.bedroom" }] }),
    );
    expect(withNeither!.isActive).toBe(false);
  });
});

describe("resolveDerivation — derived_from_access", () => {
  it("'parking_options' target is active when any parking type is configured", () => {
    const freeParking = item({
      id: "am.free_parking",
      destination: "derived_from_access",
      target: "parking_options",
    });

    const active = resolveDerivation(
      freeParking,
      ctx({ accessMethodsJson: { parking: { types: ["pk.free_on_premises"] } } }),
    );
    expect(active!.isActive).toBe(true);
    expect(active!.sourceLabel).toBe("Acceso");
    expect(active!.sourceUrl).toBe(`/properties/${propertyId}/access`);

    const inactive = resolveDerivation(
      freeParking,
      ctx({ accessMethodsJson: { parking: { types: [] } } }),
    );
    expect(inactive!.isActive).toBe(false);
  });

  it("'accessibility_features' target is active when any a11y feature is set", () => {
    const a11y = item({
      destination: "derived_from_access",
      target: "accessibility_features",
    });

    const active = resolveDerivation(
      a11y,
      ctx({
        accessMethodsJson: { accessibility: { features: ["ax.step_free_entry"] } },
      }),
    );
    expect(active!.isActive).toBe(true);

    const inactive = resolveDerivation(
      a11y,
      ctx({ accessMethodsJson: { accessibility: { features: [] } } }),
    );
    expect(inactive!.isActive).toBe(false);
  });

  it("concrete pk.* target matches when included in parking.types", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_access", target: "pk.free_on_premises" }),
      ctx({
        accessMethodsJson: { parking: { types: ["pk.free_on_premises"] } },
      }),
    );
    expect(status!.isActive).toBe(true);
  });

  it("concrete ax.* target matches when included in accessibility.features", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_access", target: "ax.step_free_entry" }),
      ctx({
        accessMethodsJson: { accessibility: { features: ["ax.step_free_entry"] } },
      }),
    );
    expect(status!.isActive).toBe(true);
  });

  it("tolerates null accessMethodsJson", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_access", target: "parking_options" }),
      ctx({ accessMethodsJson: null }),
    );
    expect(status!.isActive).toBe(false);
  });

  it("tolerates missing parking/accessibility sub-keys", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_access", target: "parking_options" }),
      ctx({ accessMethodsJson: { building: { methods: ["lockbox"] } } }),
    );
    expect(status!.isActive).toBe(false);
  });

  it("is inactive when target missing", () => {
    const status = resolveDerivation(
      item({ destination: "derived_from_access", target: undefined }),
      ctx({ accessMethodsJson: { parking: { types: ["pk.free_on_premises"] } } }),
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
