import { describe, it, expect } from "vitest";
import {
  propertySchema,
  accessSchema,
  policiesSchema,
  createContactSchema,
  updateContactSchema,
  createSpaceSchema,
  updateSpaceSchema,
  spaceFeaturesSchema,
  createBedSchema,
  updateBedSchema,
  toggleAmenitySchema,
  updateAmenitySchema,
  createSystemSchema,
  updateSystemSchema,
  updateSystemCoverageSchema,
} from "@/lib/schemas/editor.schema";

describe("Property editor schema", () => {
  it("validates complete property data", () => {
    const result = propertySchema.safeParse({
      propertyNickname: "Casa Playa",
      propertyType: "pt.apartment",
      roomType: "rt.entire_place",
      country: "España",
      city: "Valencia",
      streetAddress: "Calle Mayor, 10",
      timezone: "Europe/Madrid",
      maxGuests: 4,
      maxAdults: 4,
      maxChildren: 0,
      infantsAllowed: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = propertySchema.safeParse({
      propertyNickname: "",
      propertyType: "",
      roomType: "",
      country: "",
      city: "",
      streetAddress: "",
      timezone: "",
      maxGuests: 0,
      maxAdults: 0,
      maxChildren: 0,
      infantsAllowed: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts rt.entire_place with multiple environments + custom 'Otro' env", () => {
    const result = propertySchema.safeParse({
      propertyNickname: "Test",
      propertyType: "pt.house",
      roomType: "rt.entire_place",
      propertyEnvironments: ["env.mountain"],
      customEnvironmentLabels: ["Desierto", "Bosque"],
      country: "España",
      city: "Madrid",
      streetAddress: "Calle Sol, 5",
      timezone: "Europe/Madrid",
      maxGuests: 2,
      maxAdults: 2,
      maxChildren: 0,
      infantsAllowed: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects maxGuests below 1", () => {
    const result = propertySchema.safeParse({
      propertyNickname: "Test",
      propertyType: "pt.house",
      roomType: "rt.entire_place",
      country: "España",
      city: "Madrid",
      streetAddress: "Calle Sol, 5",
      timezone: "Europe/Madrid",
      maxGuests: 0,
      maxAdults: 0,
      maxChildren: 0,
      infantsAllowed: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("Access editor schema", () => {
  it("validates complete access data", () => {
    const result = accessSchema.safeParse({
      checkInStart: "16:00",
      checkInEnd: "22:00",
      checkOutTime: "11:00",
      isAutonomousCheckin: true,
      hasBuildingAccess: false,
      hasParking: true,
      unitAccess: { methods: ["am.smart_lock"] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty unit access methods", () => {
    const result = accessSchema.safeParse({
      checkInStart: "16:00",
      checkInEnd: "22:00",
      checkOutTime: "11:00",
      isAutonomousCheckin: false,
      hasBuildingAccess: false,
      hasParking: true,
      unitAccess: { methods: [] },
    });
    expect(result.success).toBe(false);
  });
});

describe("Contact schemas", () => {
  it("createContactSchema validates required fields", () => {
    const result = createContactSchema.safeParse({
      roleKey: "ct.host",
      entityType: "person",
      displayName: "Juan García",
    });
    expect(result.success).toBe(true);
  });

  it("createContactSchema rejects empty displayName", () => {
    const result = createContactSchema.safeParse({
      roleKey: "ct.host",
      entityType: "person",
      displayName: "",
    });
    expect(result.success).toBe(false);
  });

  it("createContactSchema rejects missing roleKey", () => {
    const result = createContactSchema.safeParse({
      roleKey: "",
      entityType: "person",
      displayName: "Juan",
    });
    expect(result.success).toBe(false);
  });

  it("createContactSchema accepts optional fields", () => {
    const result = createContactSchema.safeParse({
      roleKey: "ct.cleaning",
      entityType: "company",
      displayName: "CleanPro S.L.",
      contactPersonName: "María López",
      phone: "+34 611 111 111",
      email: "info@cleanpro.es",
      whatsapp: "+34 611 111 111",
      emergencyAvailable: true,
      hasPropertyAccess: true,
      visibility: "internal",
      isPrimary: false,
    });
    expect(result.success).toBe(true);
  });

  // 16I: type is immutable and the name renames via renameContactAction —
  // the update schema strips both (roleKey/displayName never travel here).
  it("updateContactSchema strips roleKey/displayName", () => {
    const result = updateContactSchema.safeParse({
      roleKey: "ct.host",
      displayName: "X",
      phone: "+34 600 000 000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("roleKey" in result.data).toBe(false);
      expect("displayName" in result.data).toBe(false);
    }
  });

  it("updateContactSchema accepts partial update", () => {
    const result = updateContactSchema.safeParse({
      phone: "+34 622 222 222",
    });
    expect(result.success).toBe(true);
  });
});

describe("Space schemas", () => {
  it("createSpaceSchema validates required fields", () => {
    const result = createSpaceSchema.safeParse({
      spaceType: "sp.bedroom",
      name: "Dormitorio principal",
    });
    expect(result.success).toBe(true);
  });

  // Name is optional since one-click creation (16I-4): the action derives
  // "Dormitorio 2"-style defaults from the type; only the type is required.
  it("createSpaceSchema accepts a missing name (action auto-derives it)", () => {
    const result = createSpaceSchema.safeParse({ spaceType: "sp.kitchen" });
    expect(result.success).toBe(true);
  });

  it("createSpaceSchema still requires a space type", () => {
    const result = createSpaceSchema.safeParse({ spaceType: "" });
    expect(result.success).toBe(false);
  });

  it("updateSpaceSchema accepts visibility field", () => {
    const result = updateSpaceSchema.safeParse({
      name: "Salón reformado",
      visibility: "ai",
    });
    expect(result.success).toBe(true);
  });
});

describe("Bed configuration schemas", () => {
  it("createBedSchema validates valid bed", () => {
    const result = createBedSchema.safeParse({
      bedType: "bt.king",
      quantity: 1,
    });
    expect(result.success).toBe(true);
  });

  it("createBedSchema rejects empty bedType", () => {
    const result = createBedSchema.safeParse({
      bedType: "",
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it("createBedSchema rejects quantity below 1", () => {
    const result = createBedSchema.safeParse({
      bedType: "bt.single",
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("createBedSchema rejects quantity above 10", () => {
    const result = createBedSchema.safeParse({
      bedType: "bt.single",
      quantity: 11,
    });
    expect(result.success).toBe(false);
  });

  it("updateBedSchema validates bed update", () => {
    const result = updateBedSchema.safeParse({
      bedType: "bt.double",
      quantity: 2,
    });
    expect(result.success).toBe(true);
  });

  it("updateBedSchema rejects non-integer quantity", () => {
    const result = updateBedSchema.safeParse({
      bedType: "bt.king",
      quantity: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("Space features schema", () => {
  it("accepts empty object", () => {
    expect(spaceFeaturesSchema.safeParse({}).success).toBe(true);
  });

  it("accepts boolean, string, number, and array values", () => {
    const result = spaceFeaturesSchema.safeParse({
      "sf.ac": true,
      "sf.wardrobe_type": "built_in",
      "sf.area_sqm": 18.5,
      "sf.dining_seats": 2,
      "sf.outdoor_views": ["garden", "sea"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts null values (field cleared)", () => {
    const result = spaceFeaturesSchema.safeParse({
      "sf.ac": null,
      "sf.area_sqm": null,
    });
    expect(result.success).toBe(true);
  });
});

describe("Amenity schemas", () => {
  it("toggleAmenitySchema validates toggle data", () => {
    const result = toggleAmenitySchema.safeParse({
      amenityKey: "am.wifi",
      enabled: true,
    });
    expect(result.success).toBe(true);
  });

  it("updateAmenitySchema accepts all optional fields", () => {
    const result = updateAmenitySchema.safeParse({
      subtypeKey: "drip",
      guestInstructions: "Presionar el botón rojo",
      visibility: "guest",
    });
    expect(result.success).toBe(true);
  });

  it("updateAmenitySchema accepts empty object", () => {
    const result = updateAmenitySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("Policies schema", () => {
  const validPolicies = {
    quietHours: { enabled: true, from: "22:00", to: "08:00" },
    smoking: "not_allowed" as const,
    events: { policy: "not_allowed" as const },
    commercialPhotography: "not_allowed" as const,
    pets: { allowed: false },
    supplements: {
      cleaning: { enabled: false },
      extraGuest: { enabled: false },
    },
    services: { allowed: false },
  };

  it("validates minimal policies", () => {
    const result = policiesSchema.safeParse(validPolicies);
    expect(result.success).toBe(true);
  });

  it("validates full policies with all options", () => {
    const result = policiesSchema.safeParse({
      quietHours: { enabled: true, from: "23:00", to: "07:00" },
      smoking: "designated_area",
      smokingArea: "Terraza trasera",
      events: { policy: "small_gatherings", maxPeople: 8 },
      commercialPhotography: "with_permission",
      pets: {
        allowed: true,
        types: ["dogs", "cats"],
        sizeRestriction: "custom_weight",
        maxWeightKg: 20,
        maxCount: 2,
        feeMode: "per_booking",
        feeAmount: 30,
        restrictions: ["no_bedrooms", "must_be_supervised"],
        notes: "Documentación veterinaria requerida",
      },
      supplements: {
        cleaning: { enabled: true, amount: 50 },
        extraGuest: { enabled: true, amount: 25, fromGuest: 3 },
      },
      services: {
        allowed: true,
        types: ["chef", "massage"],
        notes: "Coordinar con anfitrión",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid smoking value", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      smoking: "everywhere",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid events policy", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      events: { policy: "unlimited" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing quietHours.enabled", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      quietHours: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects pets.maxCount over 10", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      pets: { allowed: true, maxCount: 15 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts pets disabled with minimal fields", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      pets: { allowed: false },
    });
    expect(result.success).toBe(true);
  });

  it("validates supplements with amounts", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      supplements: {
        cleaning: { enabled: true, amount: 45.50 },
        extraGuest: { enabled: true, amount: 15, fromGuest: 2 },
      },
    });
    expect(result.success).toBe(true);
  });

  // 16I autosave contract: partial-but-shape-valid branches PERSIST (the
  // all-or-nothing superRefines reverted unrelated edits). Completeness is a
  // UI signal (policy-progress missing-signals), not a persistence gate.
  it("accepts quietHours enabled without from/to (partial persists)", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      quietHours: { enabled: true },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid time format in quietHours", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      quietHours: { enabled: true, from: "25:00", to: "08:00" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts quietHours disabled without from/to", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      quietHours: { enabled: false },
    });
    expect(result.success).toBe(true);
  });

  it("accepts small_gatherings without maxPeople (partial persists)", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      events: { policy: "small_gatherings" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts with_approval without instructions (partial persists)", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      events: { policy: "with_approval" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts pets allowed without detail fields (partial persists)", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      pets: { allowed: true },
    });
    expect(result.success).toBe(true);
  });

  it("accepts pets custom_weight without maxWeightKg (partial persists)", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      pets: {
        allowed: true,
        types: ["dogs"],
        sizeRestriction: "custom_weight",
        maxCount: 1,
        feeMode: "none",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts pets feeMode with charge but no feeAmount (partial persists)", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      pets: {
        allowed: true,
        types: ["dogs"],
        sizeRestriction: "none",
        maxCount: 1,
        feeMode: "per_booking",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts cleaning enabled without amount (partial persists)", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      supplements: {
        cleaning: { enabled: true },
        extraGuest: { enabled: false },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts extraGuest enabled without amount (partial persists)", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      supplements: {
        cleaning: { enabled: false },
        extraGuest: { enabled: true, fromGuest: 3 },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts extraGuest enabled without fromGuest (partial persists)", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      supplements: {
        cleaning: { enabled: false },
        extraGuest: { enabled: true, amount: 20 },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts supplements disabled without amounts", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      supplements: {
        cleaning: { enabled: false },
        extraGuest: { enabled: false },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("System schemas", () => {
  it("createSystemSchema accepts valid systemKey", () => {
    const result = createSystemSchema.safeParse({ systemKey: "sys.internet" });
    expect(result.success).toBe(true);
  });

  it("createSystemSchema rejects empty systemKey", () => {
    const result = createSystemSchema.safeParse({ systemKey: "" });
    expect(result.success).toBe(false);
  });

  it("updateSystemSchema accepts valid guest visibility", () => {
    const result = updateSystemSchema.safeParse({ visibility: "guest" });
    expect(result.success).toBe(true);
  });

  it("updateSystemSchema accepts valid internal visibility", () => {
    const result = updateSystemSchema.safeParse({ visibility: "internal" });
    expect(result.success).toBe(true);
  });

  it("updateSystemSchema rejects invalid visibility", () => {
    const result = updateSystemSchema.safeParse({ visibility: "public" });
    expect(result.success).toBe(false);
  });

  it("updateSystemSchema accepts detailsJson with mixed primitives", () => {
    const result = updateSystemSchema.safeParse({
      detailsJson: { speed: 100, provider: "Movistar", symmetric: true },
    });
    expect(result.success).toBe(true);
  });

  it("updateSystemSchema rejects detailsJson with nested objects", () => {
    const result = updateSystemSchema.safeParse({
      detailsJson: { nested: { deep: "value" } },
    });
    expect(result.success).toBe(false);
  });

  it("updateSystemCoverageSchema accepts inherited mode", () => {
    const result = updateSystemCoverageSchema.safeParse({ spaceId: "sp_123", mode: "inherited" });
    expect(result.success).toBe(true);
  });

  it("updateSystemCoverageSchema accepts override_yes mode", () => {
    const result = updateSystemCoverageSchema.safeParse({ spaceId: "sp_123", mode: "override_yes" });
    expect(result.success).toBe(true);
  });

  it("updateSystemCoverageSchema accepts override_no mode", () => {
    const result = updateSystemCoverageSchema.safeParse({ spaceId: "sp_123", mode: "override_no" });
    expect(result.success).toBe(true);
  });

  it("updateSystemCoverageSchema rejects invalid mode", () => {
    const result = updateSystemCoverageSchema.safeParse({ spaceId: "sp_123", mode: "disabled" });
    expect(result.success).toBe(false);
  });

  it("updateSystemCoverageSchema rejects missing spaceId", () => {
    const result = updateSystemCoverageSchema.safeParse({ spaceId: "", mode: "inherited" });
    expect(result.success).toBe(false);
  });
});
