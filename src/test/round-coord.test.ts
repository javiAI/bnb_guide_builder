import { describe, it, expect } from "vitest";
import { roundCoord } from "@/lib/round-coord";

describe("roundCoord", () => {
  it("collapses the float epsilon that caused the auto-save loop", () => {
    // The exact drift observed on Propiedad: a geocode/map value vs its DB
    // round-trip differed in the last digit and the form kept re-saving.
    expect(roundCoord(-0.1452657580375671)).toBe(roundCoord(-0.14526575803756714));
  });

  it("snaps to 6 decimals and is idempotent", () => {
    expect(roundCoord(40.41678912345)).toBe(40.416789);
    const once = roundCoord(40.41678912345);
    expect(roundCoord(once)).toBe(once);
  });

  it("preserves coordinates already within 6 decimals", () => {
    expect(roundCoord(-3.7037)).toBe(-3.7037);
    expect(roundCoord(0)).toBe(0);
  });
});
