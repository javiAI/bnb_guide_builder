import { describe, it, expectTypeOf } from "vitest";
import type {
  GuideTree,
  GuideSection,
  GuideItem,
  GuideItemField,
  GuideAudience,
  GuideResolverKey,
  GuideSortBy,
} from "@/lib/types/guide-tree";

describe("GuideTree typing — no accidental unknowns", () => {
  it("GuideTree.sections is GuideSection[]", () => {
    expectTypeOf<GuideTree["sections"]>().toEqualTypeOf<GuideSection[]>();
  });

  it("GuideSection.items is GuideItem[]", () => {
    expectTypeOf<GuideSection["items"]>().toEqualTypeOf<GuideItem[]>();
  });

  it("GuideItem.fields is GuideItemField[] (no unknown)", () => {
    expectTypeOf<GuideItem["fields"]>().toEqualTypeOf<GuideItemField[]>();
  });

  it("GuideItem.deprecated is a non-optional boolean", () => {
    expectTypeOf<GuideItem["deprecated"]>().toEqualTypeOf<boolean>();
  });

  it("GuideItem.warnings is a non-optional string[]", () => {
    expectTypeOf<GuideItem["warnings"]>().toEqualTypeOf<string[]>();
  });

  it("GuideAudience matches the 4-level union", () => {
    expectTypeOf<GuideAudience>().toEqualTypeOf<
      "guest" | "ai" | "internal" | "sensitive"
    >();
  });

  it("GuideSortBy matches the declared sort options", () => {
    expectTypeOf<GuideSortBy>().toEqualTypeOf<
      "taxonomy_order" | "recommended_first" | "alpha" | "explicit_order"
    >();
  });

  it("GuideResolverKey is a string literal union", () => {
    const k: GuideResolverKey = "arrival";
    expectTypeOf(k).toMatchTypeOf<string>();
  });
});
