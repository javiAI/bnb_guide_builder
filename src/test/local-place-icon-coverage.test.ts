/**
 * Icon-coverage contract for the local guide (mirror of
 * access-icon-coverage): the Record keys must match the taxonomy ids exactly
 * — a renamed/added category without an icon fails here, never silently
 * falls back in production.
 */
import { describe, it, expect } from "vitest";
import {
  LOCAL_PLACE_CATEGORY_ICONS,
  LOCAL_EVENT_CATEGORY_ICONS,
} from "@/lib/icons/local-place-icons";
import localPlaceCategories from "../../taxonomies/local_place_categories.json";
import localEventCategories from "../../taxonomies/local_event_categories.json";

function taxonomyIds(file: unknown): string[] {
  return (file as { items: { id: string }[] }).items.map((i) => i.id);
}

describe("local guide icon coverage", () => {
  it("place category icons match local_place_categories.json exactly", () => {
    expect(Object.keys(LOCAL_PLACE_CATEGORY_ICONS).sort()).toEqual(
      taxonomyIds(localPlaceCategories).sort(),
    );
  });

  it("event category icons match local_event_categories.json exactly", () => {
    expect(Object.keys(LOCAL_EVENT_CATEGORY_ICONS).sort()).toEqual(
      taxonomyIds(localEventCategories).sort(),
    );
  });
});
