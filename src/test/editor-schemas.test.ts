import { describe, it, expect } from "vitest";
import {
  propertySchema,
  accessSchema,
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
