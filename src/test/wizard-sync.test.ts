import { describe, it, expect } from "vitest";
import type { WizardStepData } from "@/lib/services/wizard-sync.service";

describe("Wizard sync types", () => {
  it("step 1 data shape is correct", () => {
    const step: WizardStepData = {
      step: 1,
      data: { propertyType: "pt.apartment", roomType: "rt.entire_place" },
    };
    expect(step.step).toBe(1);
    expect(step.data.propertyType).toBe("pt.apartment");
  });

  it("step 2 data shape is correct", () => {
    const step: WizardStepData = {
      step: 2,
      data: {
        country: "España",
        city: "Madrid",
        timezone: "Europe/Madrid",
      },
    };
    expect(step.data.country).toBe("España");
  });

  it("step 3 data shape is correct", () => {
    const step: WizardStepData = {
      step: 3,
      data: {
        maxGuests: 4,
        bedroomsCount: 2,
        bedsCount: 3,
        bathroomsCount: 1,
      },
    };
    expect(step.data.maxGuests).toBe(4);
  });

  it("step 4 data shape is correct", () => {
    const step: WizardStepData = {
      step: 4,
      data: {
        checkInStart: "16:00",
        checkInEnd: "22:00",
        checkOutTime: "11:00",
        primaryAccessMethod: "am.lockbox",
      },
    };
    expect(step.data.primaryAccessMethod).toBe("am.lockbox");
  });
});
