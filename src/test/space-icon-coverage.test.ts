import { describe, it, expect } from "vitest";
import { spaceTypes } from "@/lib/taxonomy-loader";
import { SPACE_TYPE_ICONS, getSpaceIcon } from "@/lib/icons/space-icons";

describe("space-icons coverage", () => {
  it("SPACE_TYPE_ICONS keys === space_types.json items", () => {
    const taxonomyIds = spaceTypes.items.map((i) => i.id).sort();
    const iconKeys = Object.keys(SPACE_TYPE_ICONS).sort();
    expect(iconKeys).toEqual(taxonomyIds);
  });

  it("every mapped icon is a renderable component", () => {
    for (const [id, Icon] of Object.entries(SPACE_TYPE_ICONS)) {
      expect(Icon, `icon for ${id}`).toBeTruthy();
    }
  });

  it("fallback returns a glyph for unknown ids", () => {
    expect(getSpaceIcon("sp.nonexistent")).toBeTruthy();
  });
});
