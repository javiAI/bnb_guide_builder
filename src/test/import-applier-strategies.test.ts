import { describe, it, expect } from "vitest";

import {
  InvalidResolutionError,
  StaleResolutionError,
  planApply,
  type ResolutionStrategy,
} from "@/lib/imports/shared/apply-strategies";
import type { ImportDiff } from "@/lib/imports/shared/types";

function buildDiff(): ImportDiff {
  return {
    scalar: [
      {
        field: "bedroomsCount",
        current: null,
        incoming: 3,
        status: "fresh",
        suggestedAction: "take_import",
      },
      {
        field: "bathroomsCount",
        current: 2,
        incoming: 4,
        status: "conflict",
        suggestedAction: "keep_db",
      },
      {
        field: "personCapacity",
        current: 6,
        incoming: 6,
        status: "identical",
        suggestedAction: "keep_db",
      },
    ],
    policies: [
      {
        field: "policies.smoking",
        current: null,
        incoming: "not_allowed",
        status: "fresh",
        suggestedAction: "take_import",
      },
      {
        field: "policies.events.policy",
        incoming: "allowed",
        status: "unactionable",
        reason: "lossy_projection",
        message: "Binary mapping degrades granularity.",
      },
      {
        field: "policies.supplements.cleaning.amount",
        incoming: 50,
        status: "unactionable",
        reason: "requires_currency_decision",
        message: "No currency.",
      },
    ],
    presence: [
      {
        field: "shared_spaces.kitchen",
        incoming: true,
        status: "unactionable",
        reason: "presence_signal_only",
        message: "presence boolean.",
      },
    ],
    amenities: {
      add: [
        { taxonomyId: "am.wifi", sourceExternalId: null, sourceLabelEn: null },
        { taxonomyId: "am.tv", sourceExternalId: null, sourceLabelEn: null },
      ],
      remove: [{ taxonomyId: "am.kettle" }],
      identicalCount: 1,
    },
    freeText: [
      { field: "houseRules", current: null, incoming: "no fumar." },
    ],
    customs: [
      {
        field: "propertyType",
        sourceExternalId: "loft_unique",
        sourceLabelEn: null,
        reason: "no_matching_taxonomy_item",
        suggestedCustomLabel: "loft_unique",
      },
    ],
    meta: {
      generatedAt: "2026-04-26T00:00:00.000Z",
      payloadShape: "airbnb-v1",
      currentLocale: "es",
      incomingLocale: "es",
    },
  };
}

describe("planApply — defaults match suggestedAction per category", () => {
  it("scalars take_import when status fresh, identical collapses to skip(identical)", () => {
    const plan = planApply(buildDiff(), {});
    const bed = plan.applied.find((m) => m.field === "scalar.bedroomsCount");
    expect(bed?.value).toBe(3);
    const baths = plan.skipped.find((m) => m.field === "scalar.bathroomsCount");
    expect(baths?.reason).toBe("client_keep_current");
    const cap = plan.skipped.find((m) => m.field === "scalar.personCapacity");
    expect(cap?.reason).toBe("identical");
  });

  it("amenities adds default to take_import; removes default to keep_current", () => {
    const plan = planApply(buildDiff(), {});
    expect(
      plan.applied.filter((m) => m.category === "amenities.add").length,
    ).toBe(2);
    expect(
      plan.skipped.filter(
        (m) => m.category === "amenities.remove" && m.reason === "client_keep_current",
      ).length,
    ).toBe(1);
  });

  it("policies unactionable always server-skips with warning regardless of client", () => {
    const plan = planApply(buildDiff(), {
      "policies.events.policy": "take_import",
    });
    const events = plan.skipped.find(
      (m) => m.field === "policies.events.policy",
    );
    expect(events?.reason).toBe("server_unactionable");
    const warnCodes = plan.warnings.map((w) => w.code);
    expect(warnCodes).toContain("free_text_not_reconciled");
  });
});

describe("planApply — three strategies cover every actionable entry", () => {
  it("take_import, keep_current, skip produce distinct outcomes", () => {
    const strategies: ResolutionStrategy[] = ["take_import", "keep_current", "skip"];
    for (const s of strategies) {
      const plan = planApply(buildDiff(), {
        "scalar.bathroomsCount": s,
      });
      const entry = [...plan.applied, ...plan.skipped].find(
        (m) => m.field === "scalar.bathroomsCount",
      );
      expect(entry).toBeDefined();
      if (s === "take_import") {
        expect(plan.applied.find((m) => m.field === "scalar.bathroomsCount")?.value).toBe(4);
      } else if (s === "skip") {
        expect(
          plan.skipped.find((m) => m.field === "scalar.bathroomsCount")?.reason,
        ).toBe("client_skip");
      } else {
        expect(
          plan.skipped.find((m) => m.field === "scalar.bathroomsCount")?.reason,
        ).toBe("client_keep_current");
      }
    }
  });
});

describe("planApply — server rejects resolutions on non-actionable categories", () => {
  it("freeText resolution → InvalidResolutionError", () => {
    expect(() =>
      planApply(buildDiff(), { "freeText.houseRules": "take_import" }),
    ).toThrow(InvalidResolutionError);
  });
  it("presence resolution → InvalidResolutionError", () => {
    expect(() =>
      planApply(buildDiff(), { "presence.shared_spaces.kitchen": "take_import" }),
    ).toThrow(InvalidResolutionError);
  });
  it("customs resolution → InvalidResolutionError", () => {
    expect(() =>
      planApply(buildDiff(), { "customs.propertyType": "take_import" }),
    ).toThrow(InvalidResolutionError);
  });
});

describe("planApply — stale resolutions surface missing fields", () => {
  it("client resolution for absent field → StaleResolutionError listing it", () => {
    let err: unknown;
    try {
      planApply(buildDiff(), { "amenities.add.am.unknown": "take_import" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(StaleResolutionError);
    expect((err as StaleResolutionError).missingFields).toContain(
      "amenities.add.am.unknown",
    );
  });
});
