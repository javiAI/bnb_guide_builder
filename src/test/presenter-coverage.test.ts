import { describe, it, expect } from "vitest";
import { getPresenter } from "@/config/registries/presenter-registry";
import {
  policyTaxonomy,
  getPolicyItems,
  contactTypes,
} from "@/lib/taxonomy-loader";
import { contactPresenter } from "@/lib/presenters/contact-presenter";
import { policyPresenter } from "@/lib/presenters/policy-presenter";
import { genericTextPresenter } from "@/lib/presenters/generic-text-presenter";

/** Coverage test — every taxonomy key that can appear in the guest pipeline
 * must resolve to a humanizing presenter. Unknown keys fall back to
 * `genericTextPresenter`, which drops enum/JSON leaks but cannot humanize.
 * QA_AND_RELEASE §3 invariant 5 — failure mode surfaces as
 * `presentationType: "raw"` and is logged as `missing-presenter`. */

describe("presenter coverage — policy taxonomy (pol.*)", () => {
  it("every pol.* key routes to the policy presenter", () => {
    const items = getPolicyItems(policyTaxonomy);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(getPresenter(item.id)).toBe(policyPresenter);
    }
  });
});

describe("presenter coverage — contact types (ct.*)", () => {
  it("every ct.* key routes to the contact presenter", () => {
    expect(contactTypes.items.length).toBeGreaterThan(0);
    for (const item of contactTypes.items) {
      expect(getPresenter(item.id)).toBe(contactPresenter);
    }
  });
});

describe("presenter coverage — fallback and unknowns", () => {
  it("null / undefined taxonomy keys fall back to genericTextPresenter", () => {
    expect(getPresenter(null)).toBe(genericTextPresenter);
    expect(getPresenter(undefined)).toBe(genericTextPresenter);
  });

  it("keys without a registered prefix fall back to genericTextPresenter", () => {
    // Derived (non-enum) items emit `taxonomyKey: null`; an ad-hoc key that
    // doesn't match any registered prefix still routes to the default.
    expect(getPresenter("custom.freeform")).toBe(genericTextPresenter);
    expect(getPresenter("arrival.checkin")).toBe(genericTextPresenter);
  });

  it("fee.* keys route to the policy presenter (shared schema)", () => {
    // Fees share the pol.* shape (scalar + options), so the registry aliases
    // them to the same presenter.
    expect(getPresenter("fee.cleaning")).toBe(policyPresenter);
  });
});
