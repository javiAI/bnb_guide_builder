import { describe, it, expect } from "vitest";
import { resolveSpaceAvailability } from "@/lib/services/space-availability.service";
import { getAvailableSpaceTypes } from "@/lib/taxonomy-loader";

describe("resolveSpaceAvailability", () => {
  it("returns the base matrix when no overlays apply", () => {
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      layoutKey: "layout.separate_rooms",
      propertyType: null,
      environment: null,
    });
    // Base rule for separate_rooms has sp.pool in optional — untouched.
    expect(r.optional).toContain("sp.pool");
    expect(r.recommended).not.toContain("sp.pool");
  });

  it("promotes env.beach suggestions (pool + patio + garden) into recommended", () => {
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      layoutKey: "layout.separate_rooms",
      propertyType: null,
      environment: "env.beach",
    });
    expect(r.recommended).toEqual(expect.arrayContaining(["sp.pool", "sp.patio", "sp.garden"]));
    expect(r.optional).not.toContain("sp.pool");
    expect(r.optional).not.toContain("sp.patio");
  });

  it("promotes pt.apartment → sp.balcony", () => {
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      layoutKey: "layout.separate_rooms",
      propertyType: "pt.apartment",
      environment: null,
    });
    expect(r.recommended).toContain("sp.balcony");
    expect(r.optional).not.toContain("sp.balcony");
  });

  it("merges propertyType + environment overlays (union, no dupes)", () => {
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      layoutKey: "layout.separate_rooms",
      propertyType: "pt.house", // promotes garden, garage, patio
      environment: "env.beach", // promotes pool, patio, garden
    });
    const recCount = r.recommended.filter((id) => id === "sp.patio").length;
    expect(recCount).toBe(1);
    expect(r.recommended).toEqual(
      expect.arrayContaining(["sp.pool", "sp.patio", "sp.garden", "sp.garage"]),
    );
  });

  it("never moves items across excluded — hard layout constraint wins", () => {
    // rt.private_room excludes sp.pool and sp.garden.
    // env.beach tries to promote those items; they must stay excluded
    // and must not appear in recommended.
    const r = resolveSpaceAvailability({
      roomType: "rt.private_room",
      layoutKey: null,
      propertyType: null,
      environment: "env.beach",
    });
    expect(r.excluded).toEqual(expect.arrayContaining(["sp.pool", "sp.garden"]));
    expect(r.recommended).not.toContain("sp.pool");
    expect(r.recommended).not.toContain("sp.garden");
  });

  it("never demotes required items — already-required stays required", () => {
    // layout.studio requires sp.studio; no overlay should shuffle it.
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      layoutKey: "layout.studio",
      propertyType: "pt.apartment",
      environment: "env.urban",
    });
    expect(r.required).toContain("sp.studio");
    expect(r.required).toContain("sp.bathroom");
  });

  it("is a no-op when neither propertyType nor environment match an overlay", () => {
    const base = getAvailableSpaceTypes("rt.entire_place", "layout.separate_rooms");
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      layoutKey: "layout.separate_rooms",
      propertyType: "pt.other",
      environment: null,
    });
    // No overlay matches → every bucket should equal the base rule as-is.
    // Derived from the loader so this test doesn't break when the taxonomy
    // evolves (we're asserting the no-op contract, not the taxonomy content).
    expect(r).toEqual(base);
  });
});
