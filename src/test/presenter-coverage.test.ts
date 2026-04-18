import { describe, it, expect } from "vitest";
import {
  getPresenter,
  listFallbackAllowedPrefixes,
} from "@/config/registries/presenter-registry";
import {
  policyTaxonomy,
  getPolicyItems,
  contactTypes,
} from "@/lib/taxonomy-loader";
import { contactPresenter } from "@/lib/presenters/contact-presenter";
import { policyPresenter } from "@/lib/presenters/policy-presenter";
import { genericTextPresenter } from "@/lib/presenters/generic-text-presenter";
import { rawSentinelPresenter } from "@/lib/presenters/raw-sentinel-presenter";

/** Coverage test — every taxonomy key that can appear in the guest pipeline
 * must resolve to the right presenter.
 *
 * - `pol.*` / `fee.*` / `ct.*` → specialized presenter (humanized output).
 * - `sp.*` / `am.*` / `lp.*` → `genericTextPresenter`, intentional: the
 *   resolver already substitutes the taxonomy label into `value`.
 * - Unknown prefix (not registered, not in the fallback allowlist) →
 *   `rawSentinelPresenter`, which drops the item from guest output and logs
 *   `missing-presenter`. This is the live surface for QA_AND_RELEASE §3
 *   invariant 5. */

describe("presenter coverage — specialized presenters", () => {
  it("every pol.* key routes to the policy presenter", () => {
    const items = getPolicyItems(policyTaxonomy);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(getPresenter(item.id)).toBe(policyPresenter);
    }
  });

  it("every ct.* key routes to the contact presenter", () => {
    expect(contactTypes.items.length).toBeGreaterThan(0);
    for (const item of contactTypes.items) {
      expect(getPresenter(item.id)).toBe(contactPresenter);
    }
  });

  it("fee.* keys share the policy shape and route to the policy presenter", () => {
    expect(getPresenter("fee.cleaning")).toBe(policyPresenter);
  });
});

describe("presenter coverage — intentional fallback to genericTextPresenter", () => {
  it("null / undefined taxonomy keys fall back to genericTextPresenter (derived items)", () => {
    expect(getPresenter(null)).toBe(genericTextPresenter);
    expect(getPresenter(undefined)).toBe(genericTextPresenter);
    expect(getPresenter("")).toBe(genericTextPresenter);
  });

  it("sp.* / am.* / lp.* keys route to genericTextPresenter (resolver humanizes upstream)", () => {
    // Spot-check one representative key per allowed prefix.
    expect(getPresenter("sp.bedroom")).toBe(genericTextPresenter);
    expect(getPresenter("am.wifi")).toBe(genericTextPresenter);
    expect(getPresenter("lp.restaurant")).toBe(genericTextPresenter);
  });

  it("fallback allowlist stays explicit — no accidental growth", () => {
    // If this fails, someone added a prefix to FALLBACK_ALLOWED_PREFIXES
    // without updating the coverage expectations. Bump the assertion
    // intentionally when the allowlist grows.
    expect(listFallbackAllowedPrefixes()).toEqual(["sp.", "am.", "lp."]);
  });
});

describe("presenter coverage — sentinel for unknown prefixes", () => {
  it("a taxonomyKey with no registered prefix routes to rawSentinelPresenter", () => {
    // These prefixes are not in the specialized registry nor the fallback
    // allowlist, so they must surface as missing-presenter.
    expect(getPresenter("new.unmapped")).toBe(rawSentinelPresenter);
    expect(getPresenter("custom.freeform")).toBe(rawSentinelPresenter);
    expect(getPresenter("arrival.checkin")).toBe(rawSentinelPresenter);
  });
});
