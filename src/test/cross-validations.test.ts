import { describe, it, expect } from "vitest";
import {
  validateWifiComplete,
  validateSmartLockBackup,
  validateCapacityCoherence,
  validateInfantsVsCrib,
  validateVisibilityLeaks,
  type ValidationContext,
} from "@/lib/validations/cross-validations";

function baseCtx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    propertyId: "prop-1",
    maxGuests: null,
    infantsAllowed: false,
    accessMethodsJson: null,
    systems: [],
    amenityInstances: [],
    beds: [],
    ...overrides,
  };
}

describe("validateWifiComplete", () => {
  it("no finding when sys.internet is absent (wifi isn't claimed)", () => {
    expect(validateWifiComplete(baseCtx()).length).toBe(0);
  });

  it("blocker when sys.internet exists but ssid is missing", () => {
    const out = validateWifiComplete(
      baseCtx({
        systems: [
          { systemKey: "sys.internet", detailsJson: { password: "x" }, visibility: "public" },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("blocker");
    expect(out[0].id).toBe("wifi_incomplete");
  });

  it("blocker when password is empty string", () => {
    const out = validateWifiComplete(
      baseCtx({
        systems: [
          { systemKey: "sys.internet", detailsJson: { ssid: "R", password: "   " }, visibility: "public" },
        ],
      }),
    );
    expect(out).toHaveLength(1);
  });

  it("no finding when ssid+password both present", () => {
    const out = validateWifiComplete(
      baseCtx({
        systems: [
          { systemKey: "sys.internet", detailsJson: { ssid: "R", password: "p" }, visibility: "public" },
        ],
      }),
    );
    expect(out).toHaveLength(0);
  });
});

describe("validateSmartLockBackup", () => {
  it("no finding when unit has no digital access", () => {
    expect(
      validateSmartLockBackup(
        baseCtx({ accessMethodsJson: { unit: { methods: ["am.lockbox"] } } }),
      ),
    ).toHaveLength(0);
  });

  it("blocker when only am.smart_lock is listed", () => {
    const out = validateSmartLockBackup(
      baseCtx({ accessMethodsJson: { unit: { methods: ["am.smart_lock"] } } }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("blocker");
    expect(out[0].id).toBe("smart_lock_no_backup");
  });

  it("blocker when only digital methods are listed (lock + keypad)", () => {
    const out = validateSmartLockBackup(
      baseCtx({
        accessMethodsJson: { unit: { methods: ["am.smart_lock", "am.keypad"] } },
      }),
    );
    expect(out).toHaveLength(1);
  });

  it("no finding when smart lock has lockbox backup", () => {
    const out = validateSmartLockBackup(
      baseCtx({
        accessMethodsJson: { unit: { methods: ["am.smart_lock", "am.lockbox"] } },
      }),
    );
    expect(out).toHaveLength(0);
  });

  it("no finding when accessMethodsJson is null", () => {
    expect(validateSmartLockBackup(baseCtx()).length).toBe(0);
  });
});

describe("validateCapacityCoherence", () => {
  it("no finding when maxGuests is null", () => {
    expect(validateCapacityCoherence(baseCtx()).length).toBe(0);
  });

  it("no finding when no beds are configured (not enough data)", () => {
    expect(validateCapacityCoherence(baseCtx({ maxGuests: 4 })).length).toBe(0);
  });

  it("warning when maxGuests exceeds sum of bed capacities", () => {
    const out = validateCapacityCoherence(
      baseCtx({
        maxGuests: 6,
        beds: [{ bedType: "bt.double", quantity: 1, configJson: null }], // cap 2
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("warning");
    expect(out[0].id).toBe("capacity_exceeds_beds");
  });

  it("no finding when maxGuests fits the beds", () => {
    const out = validateCapacityCoherence(
      baseCtx({
        maxGuests: 4,
        beds: [
          { bedType: "bt.double", quantity: 2, configJson: null },
        ],
      }),
    );
    expect(out).toHaveLength(0);
  });
});

describe("validateInfantsVsCrib", () => {
  it("no finding when no crib is configured", () => {
    expect(validateInfantsVsCrib(baseCtx({ infantsAllowed: false })).length).toBe(0);
  });

  it("no finding when crib + infantsAllowed=true", () => {
    const out = validateInfantsVsCrib(
      baseCtx({
        infantsAllowed: true,
        amenityInstances: [
          { amenityKey: "am.crib", subtypeKey: null, detailsJson: null, visibility: "public" },
        ],
      }),
    );
    expect(out).toHaveLength(0);
  });

  it("warning when crib exists but infantsAllowed=false", () => {
    const out = validateInfantsVsCrib(
      baseCtx({
        infantsAllowed: false,
        amenityInstances: [
          { amenityKey: "am.crib", subtypeKey: null, detailsJson: null, visibility: "public" },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("warning");
    expect(out[0].id).toBe("infants_vs_crib");
  });
});

describe("validateVisibilityLeaks", () => {
  it("no finding when amenity has no subtype", () => {
    const out = validateVisibilityLeaks(
      baseCtx({
        amenityInstances: [
          { amenityKey: "am.tv", subtypeKey: null, detailsJson: { foo: "bar" }, visibility: "public" },
        ],
      }),
    );
    expect(out).toHaveLength(0);
  });

  it("no finding when amenity visibility is internal (can contain sensitive)", () => {
    const out = validateVisibilityLeaks(
      baseCtx({
        amenityInstances: [
          {
            amenityKey: "am.coffee_maker",
            subtypeKey: "am.coffee_maker",
            detailsJson: { "coffee_maker.supplies_location": "armario" },
            visibility: "internal",
          },
        ],
      }),
    );
    expect(out).toHaveLength(0);
  });

  it("no finding when subtype has no sensitive fields populated", () => {
    // am.coffee_maker has only public/internal fields, no sensitive.
    const out = validateVisibilityLeaks(
      baseCtx({
        amenityInstances: [
          {
            amenityKey: "am.coffee_maker",
            subtypeKey: "am.coffee_maker",
            detailsJson: { "coffee_maker.subtype": "drip" },
            visibility: "public",
          },
        ],
      }),
    );
    expect(out).toHaveLength(0);
  });
});
