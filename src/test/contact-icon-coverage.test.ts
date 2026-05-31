import { describe, it, expect } from "vitest";
import { contactTypes } from "@/lib/contact-types-loader";
import {
  CONTACT_TYPE_ICONS,
  CONTACT_GROUP_TONE,
  contactIconFor,
  contactGroupTone,
} from "@/lib/icons/contact-icons";

describe("contact-icons coverage", () => {
  it("CONTACT_TYPE_ICONS keys === contact_types.json item ids", () => {
    const taxonomyIds = contactTypes.items.map((i) => i.id).sort();
    const iconKeys = Object.keys(CONTACT_TYPE_ICONS).sort();
    expect(iconKeys).toEqual(taxonomyIds);
  });

  it("CONTACT_GROUP_TONE keys === contact_types.json group ids", () => {
    const groupIds = contactTypes.groups.map((g) => g.id).sort();
    const toneKeys = Object.keys(CONTACT_GROUP_TONE).sort();
    expect(toneKeys).toEqual(groupIds);
  });

  it("every contact type resolves to a truthy icon component", () => {
    for (const item of contactTypes.items) {
      expect(CONTACT_TYPE_ICONS[item.id]).toBeTruthy();
    }
  });

  it("fallback helpers return a sensible default for unknown ids", () => {
    expect(contactIconFor("ct.unknown")).toBeTruthy();
    expect(contactGroupTone("ctg.unknown")).toBe("neutral");
  });
});
