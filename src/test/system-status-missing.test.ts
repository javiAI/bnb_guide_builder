import { describe, it, expect } from "vitest";
import {
  SYSTEM_STATUS_KEY,
  SYSTEM_STATUS_LABEL,
  computeCompleteness,
  missingSystemFieldLabels,
  formatMissingDetail,
} from "@/app/properties/[propertyId]/systems/_components/system-status";
import type { SystemSubtype } from "@/lib/types/taxonomy";

// Minimal subtype fixture: two details fields + one ops field, declaration order
// is what missingSystemFieldLabels must preserve (details first, then ops).
const subtype = {
  detailsFields: [
    { id: "fuel_type", label: "Tipo de combustible" },
    { id: "system_type", label: "Tipo de sistema" },
  ],
  opsFields: [{ id: "maintenance", label: "Mantenimiento" }],
} as unknown as SystemSubtype;

describe("system-status — canonical mappings", () => {
  it("maps domain status → canonical entity-card vocabulary", () => {
    expect(SYSTEM_STATUS_KEY).toEqual({
      configured: "complete",
      incomplete: "partial",
      empty: "empty",
    });
  });

  it("uses the canonical 16I Spanish labels", () => {
    expect(SYSTEM_STATUS_LABEL).toEqual({
      configured: "Configurado",
      incomplete: "En progreso",
      empty: "Sin empezar",
    });
  });
});

describe("missingSystemFieldLabels", () => {
  it("returns [] for a subtypeless system", () => {
    expect(missingSystemFieldLabels(null, {}, {})).toEqual([]);
  });

  it("returns [] when every field is filled", () => {
    const labels = missingSystemFieldLabels(
      subtype,
      { fuel_type: "gas", system_type: "central" },
      { maintenance: "anual" },
    );
    expect(labels).toEqual([]);
    // and stays in sync with computeCompleteness
    expect(
      computeCompleteness(
        subtype,
        { fuel_type: "gas", system_type: "central" },
        { maintenance: "anual" },
      ).status,
    ).toBe("configured");
  });

  it("lists missing labels in declaration order (details before ops)", () => {
    expect(missingSystemFieldLabels(subtype, {}, {})).toEqual([
      "Tipo de combustible",
      "Tipo de sistema",
      "Mantenimiento",
    ]);
  });

  it("treats empty string / empty array as not filled, partial otherwise", () => {
    const labels = missingSystemFieldLabels(
      subtype,
      { fuel_type: "gas", system_type: "" },
      { maintenance: [] },
    );
    expect(labels).toEqual(["Tipo de sistema", "Mantenimiento"]);
  });
});

describe("formatMissingDetail", () => {
  it("returns undefined when nothing is missing", () => {
    expect(formatMissingDetail([])).toBeUndefined();
  });

  it("joins up to three labels with a Falta: prefix", () => {
    expect(formatMissingDetail(["A", "B", "C"])).toBe("Falta: A, B, C");
  });

  it("caps at three and appends 'y N más'", () => {
    expect(formatMissingDetail(["A", "B", "C", "D", "E"])).toBe(
      "Falta: A, B, C y 2 más",
    );
  });
});
