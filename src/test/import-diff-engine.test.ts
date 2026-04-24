import { describe, it, expect } from "vitest";
import { computeImportDiff } from "@/lib/imports/shared/diff-engine";
import type { PropertyExportContext } from "@/lib/exports/shared/load-property";
import type { PropertyImportContext } from "@/lib/imports/shared/types";

function currentCtx(
  overrides: Partial<PropertyExportContext> = {},
): PropertyExportContext {
  return {
    propertyType: "pt.house",
    customPropertyTypeLabel: null,
    bedroomsCount: 3,
    bathroomsCount: 2,
    personCapacity: 6,
    primaryAccessMethod: "am.smart_lock",
    customAccessMethodLabel: null,
    policiesJson: {
      smoking: "not_allowed",
      events: { policy: "not_allowed" },
      pets: { allowed: false },
      commercialPhotography: "not_allowed",
    },
    presentSpaceTypes: new Set(["sp.bedroom", "sp.bathroom"]),
    spaceTypeCounts: { "sp.bedroom": 3, "sp.bathroom": 2 },
    presentAmenityKeys: new Set(["am.wifi", "am.kitchen"]),
    defaultLocale: "es",
    ...overrides,
  };
}

function incomingCtx(
  overrides: Partial<PropertyImportContext> = {},
): PropertyImportContext {
  return {
    propertyType: {
      taxonomyId: "pt.house",
      sourceExternalId: "house",
      sourceLabelEn: "House",
    },
    customPropertyTypeLabel: null,
    bedroomsCount: 3,
    bathroomsCount: 2,
    personCapacity: 6,
    primaryAccessMethod: {
      taxonomyId: "am.smart_lock",
      sourceExternalId: "smart_lock",
      sourceLabelEn: "Smart lock",
    },
    customAccessMethodLabel: null,
    policiesPartial: {},
    incomingAmenityKeys: new Set(["am.wifi", "am.kitchen"]),
    presencePings: {
      sharedSpaces: {},
      amenitiesShellBools: {},
      accessibilityFeatures: {},
    },
    freeText: { houseRules: null },
    pricing: { cleaningFee: null, extraPersonFee: null, currency: null },
    unresolvedExternalIds: [],
    incomingLocale: "es",
    ...overrides,
  };
}

describe("computeImportDiff — scalar 3-state", () => {
  it("marks identical when current === incoming", () => {
    const { diff } = computeImportDiff(currentCtx(), incomingCtx(), {
      payloadShape: "airbnb-v1",
    });
    const bedroomsEntry = diff.scalar.find((e) => e.field === "bedroomsCount");
    expect(bedroomsEntry).toBeDefined();
    if (bedroomsEntry?.status === "unactionable") throw new Error("unexpected");
    expect(bedroomsEntry?.status).toBe("identical");
    expect(bedroomsEntry?.suggestedAction).toBe("keep_db");
  });

  it("marks fresh when current is null", () => {
    const { diff } = computeImportDiff(
      currentCtx({ bedroomsCount: null }),
      incomingCtx({ bedroomsCount: 4 }),
      { payloadShape: "airbnb-v1" },
    );
    const entry = diff.scalar.find((e) => e.field === "bedroomsCount");
    if (entry?.status === "unactionable") throw new Error("unexpected");
    expect(entry?.status).toBe("fresh");
    expect(entry?.suggestedAction).toBe("take_import");
  });

  it("marks conflict when current !== incoming and both are set", () => {
    const { diff } = computeImportDiff(
      currentCtx({ bedroomsCount: 3 }),
      incomingCtx({ bedroomsCount: 5 }),
      { payloadShape: "airbnb-v1" },
    );
    const entry = diff.scalar.find((e) => e.field === "bedroomsCount");
    if (entry?.status === "unactionable") throw new Error("unexpected");
    expect(entry?.status).toBe("conflict");
    expect(entry?.suggestedAction).toBe("keep_db");
  });
});

describe("computeImportDiff — policies.events.policy lossy_projection", () => {
  it("degrades to lossy_projection when DB has granularity > binary", () => {
    const { diff } = computeImportDiff(
      currentCtx({
        policiesJson: { events: { policy: "allowed_quiet" } },
      }),
      incomingCtx({ policiesPartial: { events: { policy: "allowed" } } }),
      { payloadShape: "airbnb-v1" },
    );
    const entry = diff.policies.find(
      (e) => e.field === "policies.events.policy",
    );
    expect(entry).toBeDefined();
    expect(entry?.status).toBe("unactionable");
    if (entry?.status !== "unactionable") throw new Error("unexpected");
    expect(entry.reason).toBe("lossy_projection");
    expect(entry.message).toMatch(/granularity/i);
  });

  it("treats binary-to-binary as a normal scalar entry", () => {
    const { diff } = computeImportDiff(
      currentCtx({ policiesJson: { events: { policy: "not_allowed" } } }),
      incomingCtx({ policiesPartial: { events: { policy: "allowed" } } }),
      { payloadShape: "airbnb-v1" },
    );
    const entry = diff.policies.find(
      (e) => e.field === "policies.events.policy",
    );
    if (entry?.status === "unactionable") throw new Error("unexpected");
    expect(entry?.status).toBe("conflict");
  });
});

describe("computeImportDiff — pricing always unactionable", () => {
  it("marks cleaning fee as requires_currency_decision", () => {
    const { diff } = computeImportDiff(
      currentCtx(),
      incomingCtx({
        pricing: { cleaningFee: 50, extraPersonFee: null, currency: "EUR" },
      }),
      { payloadShape: "airbnb-v1" },
    );
    const entry = diff.policies.find(
      (e) => e.field === "policies.supplements.cleaning.amount",
    );
    expect(entry?.status).toBe("unactionable");
    if (entry?.status !== "unactionable") throw new Error("unexpected");
    expect(entry.reason).toBe("requires_currency_decision");
  });
});

describe("computeImportDiff — presence always unactionable presence_signal_only", () => {
  it("emits presence_signal_only for shared_spaces bools", () => {
    const { diff } = computeImportDiff(
      currentCtx(),
      incomingCtx({
        presencePings: {
          sharedSpaces: { kitchen: true },
          amenitiesShellBools: {},
          accessibilityFeatures: {},
        },
      }),
      { payloadShape: "airbnb-v1" },
    );
    expect(diff.presence.length).toBeGreaterThan(0);
    for (const entry of diff.presence) {
      expect(entry.status).toBe("unactionable");
      expect(entry.reason).toBe("presence_signal_only");
    }
  });

  it("does not emit entries for false presence bools", () => {
    const { diff } = computeImportDiff(
      currentCtx(),
      incomingCtx({
        presencePings: {
          sharedSpaces: { kitchen: false },
          amenitiesShellBools: {},
          accessibilityFeatures: {},
        },
      }),
      { payloadShape: "airbnb-v1" },
    );
    expect(diff.presence).toHaveLength(0);
  });
});

describe("computeImportDiff — amenities set diff", () => {
  it("classifies added / removed / identical correctly", () => {
    const { diff } = computeImportDiff(
      currentCtx({
        presentAmenityKeys: new Set(["am.wifi", "am.kitchen"]),
      }),
      incomingCtx({
        incomingAmenityKeys: new Set(["am.wifi", "am.pool"]),
      }),
      { payloadShape: "airbnb-v1" },
    );
    expect(diff.amenities.add.map((a) => a.taxonomyId)).toEqual(["am.pool"]);
    expect(diff.amenities.remove.map((r) => r.taxonomyId)).toEqual([
      "am.kitchen",
    ]);
    expect(diff.amenities.identicalCount).toBe(1);
  });
});

describe("computeImportDiff — customs for unresolved scalars", () => {
  it("emits customs entry when propertyType has no taxonomy match", () => {
    const { diff } = computeImportDiff(
      currentCtx(),
      incomingCtx({
        propertyType: {
          taxonomyId: null,
          sourceExternalId: "treehouse",
          sourceLabelEn: "Treehouse",
        },
      }),
      { payloadShape: "airbnb-v1" },
    );
    const entry = diff.customs.find((c) => c.field === "propertyType");
    expect(entry).toBeDefined();
    expect(entry?.sourceExternalId).toBe("treehouse");
    expect(entry?.reason).toBe("no_matching_taxonomy_item");
  });

  it("never auto-resolves a scalar with a custom label", () => {
    const { diff } = computeImportDiff(
      currentCtx({ propertyType: null }),
      incomingCtx({
        propertyType: {
          taxonomyId: null,
          sourceExternalId: "mansion",
          sourceLabelEn: "Mansion",
        },
      }),
      { payloadShape: "airbnb-v1" },
    );
    // No scalar entry emitted — a null taxonomyId never populates a scalar row
    const ptEntry = diff.scalar.find((e) => e.field === "propertyType");
    expect(ptEntry).toBeUndefined();
    // Instead a customs entry with suggestion
    expect(diff.customs.find((c) => c.field === "propertyType")).toBeDefined();
  });
});

describe("computeImportDiff — free text diff-only", () => {
  it("emits freeText entry with current=null and a warning", () => {
    const { diff, warnings } = computeImportDiff(
      currentCtx(),
      incomingCtx({ freeText: { houseRules: "No pets please." } }),
      { payloadShape: "airbnb-v1" },
    );
    expect(diff.freeText).toHaveLength(1);
    expect(diff.freeText[0]).toEqual({
      field: "houseRules",
      current: null,
      incoming: "No pets please.",
    });
    expect(warnings.some((w) => w.code === "free_text_not_reconciled")).toBe(
      true,
    );
  });
});

describe("computeImportDiff — locale mismatch warning", () => {
  it("warns when incoming locale differs from defaultLocale", () => {
    const { warnings } = computeImportDiff(
      currentCtx({ defaultLocale: "es" }),
      incomingCtx({ incomingLocale: "en" }),
      { payloadShape: "airbnb-v1" },
    );
    expect(warnings.some((w) => w.code === "locale_mismatch")).toBe(true);
  });

  it("does not warn when incoming locale matches", () => {
    const { warnings } = computeImportDiff(
      currentCtx({ defaultLocale: "es" }),
      incomingCtx({ incomingLocale: "es" }),
      { payloadShape: "airbnb-v1" },
    );
    expect(warnings.some((w) => w.code === "locale_mismatch")).toBe(false);
  });
});

describe("computeImportDiff — unactionable entries always carry a reason (gate)", () => {
  it("every unactionable entry in policies/presence has a non-empty reason", () => {
    const { diff } = computeImportDiff(
      currentCtx({
        policiesJson: { events: { policy: "allowed_quiet" } },
      }),
      incomingCtx({
        policiesPartial: { events: { policy: "allowed" } },
        pricing: { cleaningFee: 30, extraPersonFee: 10, currency: "EUR" },
        presencePings: {
          sharedSpaces: { kitchen: true },
          amenitiesShellBools: { workspace: true },
          accessibilityFeatures: { step_free_guest_entrance: true },
        },
      }),
      { payloadShape: "airbnb-v1" },
    );

    const allUnactionable = [
      ...diff.policies.filter((e) => e.status === "unactionable"),
      ...diff.presence,
    ];
    expect(allUnactionable.length).toBeGreaterThan(0);
    for (const entry of allUnactionable) {
      if (entry.status !== "unactionable") throw new Error("expected unactionable");
      expect(entry.reason).toBeTruthy();
      expect(entry.message).toBeTruthy();
    }
  });
});
