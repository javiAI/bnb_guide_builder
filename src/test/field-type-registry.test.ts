import { describe, it, expect } from "vitest";
import {
  FIELD_TYPES,
  getFieldType,
  isKnownFieldType,
  type FieldTypeMeta,
  type SubtypeFieldType,
} from "@/config/registries/field-type-registry";

// Minimal field builder for validator tests.
function field(
  type: SubtypeFieldType,
  overrides: Partial<FieldTypeMeta> = {},
): FieldTypeMeta {
  return {
    id: "f1",
    label: "Campo",
    type,
    ...overrides,
  };
}

describe("field-type-registry — validate", () => {
  it("boolean accepts booleans, rejects strings", () => {
    const s = getFieldType("boolean").validate(field("boolean"));
    expect(s.safeParse(true).success).toBe(true);
    expect(s.safeParse("true").success).toBe(false);
  });

  it("text required rejects empty string, accepts non-empty", () => {
    const s = getFieldType("text").validate(field("text", { required: true }));
    expect(s.safeParse("").success).toBe(false);
    expect(s.safeParse("hola").success).toBe(true);
  });

  it("text optional accepts null and empty", () => {
    const s = getFieldType("text").validate(field("text"));
    expect(s.safeParse(null).success).toBe(true);
    expect(s.safeParse(undefined).success).toBe(true);
    expect(s.safeParse("").success).toBe(true);
  });

  it("text_optional never requires non-empty", () => {
    const s = getFieldType("text_optional").validate(
      field("text_optional", { required: true }),
    );
    expect(s.safeParse(null).success).toBe(true);
    expect(s.safeParse("").success).toBe(true);
  });

  it("enum rejects values outside the options list", () => {
    const s = getFieldType("enum").validate(
      field("enum", {
        required: true,
        options: [
          { id: "a", label: "A", description: "" },
          { id: "b", label: "B", description: "" },
        ],
      }),
    );
    expect(s.safeParse("a").success).toBe(true);
    expect(s.safeParse("c").success).toBe(false);
  });

  it("enum_optional accepts null regardless of required flag", () => {
    const s = getFieldType("enum_optional").validate(
      field("enum_optional", {
        required: true,
        options: [{ id: "a", label: "A", description: "" }],
      }),
    );
    expect(s.safeParse(null).success).toBe(true);
    expect(s.safeParse("a").success).toBe(true);
    expect(s.safeParse("z").success).toBe(false);
  });

  it("number required rejects non-numbers", () => {
    const s = getFieldType("number").validate(field("number", { required: true }));
    expect(s.safeParse(5).success).toBe(true);
    expect(s.safeParse("5").success).toBe(false);
  });

  it("number_optional rejects Infinity", () => {
    const s = getFieldType("number_optional").validate(field("number_optional"));
    expect(s.safeParse(Infinity).success).toBe(false);
    expect(s.safeParse(null).success).toBe(true);
  });

  it("date enforces YYYY-MM-DD", () => {
    const s = getFieldType("date").validate(field("date", { required: true }));
    expect(s.safeParse("2026-04-15").success).toBe(true);
    expect(s.safeParse("15/04/2026").success).toBe(false);
  });

  it("time_range_optional enforces HH:MM-HH:MM", () => {
    const s = getFieldType("time_range_optional").validate(field("time_range_optional"));
    expect(s.safeParse("09:00-11:30").success).toBe(true);
    expect(s.safeParse("9-11").success).toBe(false);
    expect(s.safeParse(null).success).toBe(true);
  });

  it("number_list_optional accepts comma-separated digits", () => {
    const s = getFieldType("number_list_optional").validate(field("number_list_optional"));
    expect(s.safeParse("1, 2, 30").success).toBe(true);
    expect(s.safeParse("1, a").success).toBe(false);
  });

  it("markdown_short, textarea, sensitive_text, password validate as free text", () => {
    for (const t of ["markdown_short", "textarea", "sensitive_text", "password"] as const) {
      const req = getFieldType(t).validate(field(t, { required: true }));
      expect(req.safeParse("").success).toBe(false);
      expect(req.safeParse("x").success).toBe(true);
      const opt = getFieldType(t).validate(field(t));
      expect(opt.safeParse(null).success).toBe(true);
    }
  });
});

describe("field-type-registry — lookup", () => {
  it("getFieldType throws with list for unknown types", () => {
    expect(() => getFieldType("bogus")).toThrow(/Unknown field type "bogus"/);
    expect(() => getFieldType("bogus")).toThrow(/boolean.*text/);
  });

  it("getFieldType rejects prototype keys", () => {
    expect(() => getFieldType("__proto__")).toThrow(/Unknown field type/);
    expect(() => getFieldType("toString")).toThrow(/Unknown field type/);
  });

  it("isKnownFieldType narrows correctly", () => {
    expect(isKnownFieldType("boolean")).toBe(true);
    expect(isKnownFieldType("bogus")).toBe(false);
  });

  it("boolean is the only wrapsOwnLabel entry", () => {
    const wrapping = Object.entries(FIELD_TYPES)
      .filter(([, e]) => (e as { wrapsOwnLabel?: boolean }).wrapsOwnLabel === true)
      .map(([k]) => k);
    expect(wrapping).toEqual(["boolean"]);
  });
});
