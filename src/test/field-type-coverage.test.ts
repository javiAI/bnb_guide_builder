import { describe, it, expect } from "vitest";
import {
  FIELD_TYPES,
  isKnownFieldType,
} from "@/config/registries/field-type-registry";
import { FIELD_RENDERER_KEYS } from "@/config/registries/field-type-renderers";
import amenitySubtypes from "../../taxonomies/amenity_subtypes.json";
import systemSubtypes from "../../taxonomies/system_subtypes.json";

// Guarantees that:
// 1. Every `type` string in the taxonomy JSONs is a registered type — no
//    silent fallback to text for a typo'd key (which was the pre-registry
//    behavior and hid photo/video silently for months).
// 2. Validator keys and renderer keys stay in sync — adding one without the
//    other would produce a type that validates but cannot render, or vice
//    versa.
describe("field-type-registry — coverage", () => {
  it("every amenity_subtypes.json field.type is registered", () => {
    const unknown: string[] = [];
    for (const st of amenitySubtypes.subtypes) {
      for (const f of st.fields) {
        if (!isKnownFieldType(f.type)) {
          unknown.push(`${st.amenity_id}.${f.id} → "${f.type}"`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });

  it("every system_subtypes.json field.type is registered", () => {
    const unknown: string[] = [];
    for (const st of systemSubtypes.subtypes) {
      for (const f of [...st.detailsFields, ...st.opsFields]) {
        if (!isKnownFieldType(f.type)) {
          unknown.push(`${st.id}.${f.id} → "${f.type}"`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });

  it("validator and renderer registries expose the same keys", () => {
    const validatorKeys = Object.keys(FIELD_TYPES).sort();
    const rendererKeys = [...FIELD_RENDERER_KEYS].sort();
    expect(rendererKeys).toEqual(validatorKeys);
  });
});
