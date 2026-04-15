import { describe, it, expect } from "vitest";
import { resolveSpaceAvailability } from "@/lib/services/space-availability.service";

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
    // rt.private_room excludes sp.pool / sp.garden / sp.patio.
    // env.beach tries to promote all three: all three must stay excluded,
    // and none of them should appear in recommended.
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
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      layoutKey: "layout.separate_rooms",
      propertyType: "pt.other",
      environment: null,
    });
    // Should match the base recommended list exactly (unchanged).
    expect(r.recommended).toEqual(["sp.kitchen", "sp.living_room", "sp.bedroom"]);
  });
});
