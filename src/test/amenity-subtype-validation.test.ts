import { describe, it, expect } from "vitest";
import { buildSubtypeDetailsSchema } from "@/lib/schemas/editor.schema";
import { findSubtype } from "@/lib/taxonomy-loader";
import type { SubtypeField } from "@/lib/types/taxonomy";

describe("buildSubtypeDetailsSchema — field types", () => {
  it("validates boolean / number_optional / enum / text", () => {
    const fields: SubtypeField[] = [
      { id: "b", label: "b", description: "", type: "boolean" },
      { id: "n", label: "n", description: "", type: "number_optional" },
      {
        id: "e",
        label: "e",
        description: "",
        type: "enum",
        options: [
          { id: "a", label: "A", description: "" },
          { id: "b", label: "B", description: "" },
        ],
      },
      { id: "t", label: "t", description: "", type: "text_optional" },
    ];
    const schema = buildSubtypeDetailsSchema(fields);

    expect(schema.safeParse({ b: true, n: 12.5, e: "a", t: "hola" }).success).toBe(true);
    expect(schema.safeParse({ b: "true", n: 1, e: "a", t: "" }).success).toBe(false);
    expect(schema.safeParse({ b: true, n: 1, e: "zzz", t: "x" }).success).toBe(false);
    expect(schema.safeParse({ b: true, n: Infinity, e: "a", t: "x" }).success).toBe(false);
  });

  it("treats optional fields as nullish", () => {
    const schema = buildSubtypeDetailsSchema([
      { id: "s", label: "s", description: "", type: "text_optional" },
    ]);
    expect(schema.safeParse({ s: null }).success).toBe(true);
    expect(schema.safeParse({ s: undefined }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("rejects empty string for required text fields", () => {
    const schema = buildSubtypeDetailsSchema([
      { id: "s", label: "Nombre", description: "", type: "text", required: true },
    ]);
    expect(schema.safeParse({ s: "" }).success).toBe(false);
    expect(schema.safeParse({ s: "ok" }).success).toBe(true);
  });

  it("validates time_range_optional format", () => {
    const schema = buildSubtypeDetailsSchema([
      { id: "r", label: "r", description: "", type: "time_range_optional" },
    ]);
    expect(schema.safeParse({ r: "08:00-20:00" }).success).toBe(true);
    expect(schema.safeParse({ r: "8:00-20:00" }).success).toBe(false);
    expect(schema.safeParse({ r: "08:00" }).success).toBe(false);
    expect(schema.safeParse({ r: null }).success).toBe(true);
  });

  it("validates number_list_optional format", () => {
    const schema = buildSubtypeDetailsSchema([
      { id: "l", label: "l", description: "", type: "number_list_optional" },
    ]);
    expect(schema.safeParse({ l: "1,2,3" }).success).toBe(true);
    expect(schema.safeParse({ l: "1, 2 , 3" }).success).toBe(true);
    expect(schema.safeParse({ l: "1,a,3" }).success).toBe(false);
  });
});

describe("buildSubtypeDetailsSchema — real taxonomy", () => {
  it("accepts a valid am.coffee_maker payload", () => {
    const subtype = findSubtype("am.coffee_maker");
    expect(subtype).toBeDefined();
    const schema = buildSubtypeDetailsSchema(subtype!.fields);
    const result = schema.safeParse({
      "coffee_maker.subtype": "pod_nespresso",
      "coffee_maker.pods_system": "Nespresso Original",
      "coffee_maker.instructions": "Pulsa el botón grande.",
      "coffee_maker.welcome_pack": "starter_small",
      "coffee_maker.supplies_location": "Cajón superior de la cocina",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown enum values on am.coffee_maker", () => {
    const subtype = findSubtype("am.coffee_maker")!;
    const schema = buildSubtypeDetailsSchema(subtype.fields);
    const result = schema.safeParse({
      "coffee_maker.subtype": "telepathic",
      "coffee_maker.instructions": "x",
    });
    expect(result.success).toBe(false);
  });
});
