import { describe, it, expect } from "vitest";
import { resolveSpaceAvailability } from "@/lib/services/space-availability.service";
import { getAvailableSpaceTypes } from "@/lib/taxonomy-loader";

describe("resolveSpaceAvailability", () => {
  it("returns the base matrix when no overlays apply", () => {
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      propertyType: null,
      environments: [],
    });
    // Base entire_place rule has sp.pool in optional — untouched.
    expect(r.optional).toContain("sp.pool");
    expect(r.recommended).not.toContain("sp.pool");
  });

  it("promotes env.beach suggestions (pool + patio + garden) into recommended", () => {
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      propertyType: null,
      environments: ["env.beach"],
    });
    expect(r.recommended).toEqual(expect.arrayContaining(["sp.pool", "sp.patio", "sp.garden"]));
    expect(r.optional).not.toContain("sp.pool");
    expect(r.optional).not.toContain("sp.patio");
  });

  it("promotes pt.apartment → sp.balcony", () => {
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      propertyType: "pt.apartment",
      environments: [],
    });
    expect(r.recommended).toContain("sp.balcony");
    expect(r.optional).not.toContain("sp.balcony");
  });

  it("merges propertyType + environment overlays (union, no dupes)", () => {
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      propertyType: "pt.house", // promotes garden, garage, patio
      environments: ["env.beach"], // promotes pool, patio, garden
    });
    const recCount = r.recommended.filter((id) => id === "sp.patio").length;
    expect(recCount).toBe(1);
    expect(r.recommended).toEqual(
      expect.arrayContaining(["sp.pool", "sp.patio", "sp.garden", "sp.garage"]),
    );
  });

  it("unions overlays from MULTIPLE environments (multiselect)", () => {
    // A property can be several environments at once. beach promotes pool/patio/
    // garden; urban promotes balcony — the selected set should collect all.
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      propertyType: null,
      environments: ["env.beach", "env.urban"],
    });
    expect(r.recommended).toEqual(
      expect.arrayContaining(["sp.pool", "sp.patio", "sp.garden", "sp.balcony"]),
    );
  });

  it("never moves items across excluded — roomType constraint wins", () => {
    // rt.private_room excludes sp.pool and sp.garden.
    // env.beach tries to promote those items; they must stay excluded
    // and must not appear in recommended.
    const r = resolveSpaceAvailability({
      roomType: "rt.private_room",
      propertyType: null,
      environments: ["env.beach"],
    });
    expect(r.excluded).toEqual(expect.arrayContaining(["sp.pool", "sp.garden"]));
    expect(r.recommended).not.toContain("sp.pool");
    expect(r.recommended).not.toContain("sp.garden");
  });

  it("never demotes required items — already-required stays required", () => {
    // sp.bathroom is required for entire_place; overlays only promote optional →
    // recommended and must never pull a required item out of `required`.
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      propertyType: "pt.apartment",
      environments: ["env.urban"],
    });
    expect(r.required).toContain("sp.bathroom");
  });

  it("is a no-op when neither propertyType nor environment match an overlay", () => {
    const base = getAvailableSpaceTypes("rt.entire_place");
    const r = resolveSpaceAvailability({
      roomType: "rt.entire_place",
      propertyType: "pt.other",
      environments: [],
    });
    // No overlay matches → every bucket should equal the base rule as-is.
    expect(r).toEqual(base);
  });
});
