import { describe, it, expect } from "vitest";
import {
  propertySchema,
  accessSchema,
  policiesSchema,
  createContactSchema,
  updateContactSchema,
  createSpaceSchema,
  updateSpaceSchema,
  toggleAmenitySchema,
  updateAmenitySchema,
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
      bedroomsCount: 2,
      bathroomsCount: 1,
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
      bedroomsCount: 0,
      bathroomsCount: 0,
    });
    expect(result.success).toBe(false);
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
      bedroomsCount: 1,
      bathroomsCount: 1,
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

  it("updateContactSchema rejects empty displayName", () => {
    const result = updateContactSchema.safeParse({
      displayName: "",
    });
    expect(result.success).toBe(false);
  });

  it("updateContactSchema accepts partial update", () => {
    const result = updateContactSchema.safeParse({
      displayName: "Updated Name",
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

  it("createSpaceSchema rejects empty name", () => {
    const result = createSpaceSchema.safeParse({
      spaceType: "sp.kitchen",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("updateSpaceSchema accepts visibility field", () => {
    const result = updateSpaceSchema.safeParse({
      name: "Salón reformado",
      visibility: "booked_guest",
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
      visibility: "public",
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

  it("rejects quietHours enabled without from/to", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      quietHours: { enabled: true },
    });
    expect(result.success).toBe(false);
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

  it("rejects small_gatherings without maxPeople", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      events: { policy: "small_gatherings" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects with_approval without instructions", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      events: { policy: "with_approval" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects pets allowed without required fields", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      pets: { allowed: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects pets custom_weight without maxWeightKg", () => {
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
    expect(result.success).toBe(false);
  });

  it("rejects pets feeMode with charge but no feeAmount", () => {
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
    expect(result.success).toBe(false);
  });

  it("rejects cleaning enabled without amount", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      supplements: {
        cleaning: { enabled: true },
        extraGuest: { enabled: false },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects extraGuest enabled without amount", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      supplements: {
        cleaning: { enabled: false },
        extraGuest: { enabled: true, fromGuest: 3 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects extraGuest enabled without fromGuest", () => {
    const result = policiesSchema.safeParse({
      ...validPolicies,
      supplements: {
        cleaning: { enabled: false },
        extraGuest: { enabled: true, amount: 20 },
      },
    });
    expect(result.success).toBe(false);
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
