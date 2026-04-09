import { describe, it, expect } from "vitest";
import {
  basicsSchema,
  arrivalSchema,
  createSpaceSchema,
  updateSpaceSchema,
  toggleAmenitySchema,
  updateAmenitySchema,
} from "@/lib/schemas/editor.schema";

describe("Basics editor schema", () => {
  it("validates complete basics data", () => {
    const result = basicsSchema.safeParse({
      propertyNickname: "Casa Playa",
      propertyType: "pt.apartment",
      roomType: "rt.entire_place",
      country: "España",
      city: "Valencia",
      timezone: "Europe/Madrid",
      maxGuests: 4,
      bedroomsCount: 2,
      bedsCount: 3,
      bathroomsCount: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = basicsSchema.safeParse({
      propertyNickname: "",
      propertyType: "",
      roomType: "",
      country: "",
      city: "",
      timezone: "",
      maxGuests: 0,
      bedroomsCount: 0,
      bedsCount: 0,
      bathroomsCount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields as undefined", () => {
    const result = basicsSchema.safeParse({
      propertyNickname: "Test",
      propertyType: "pt.house",
      roomType: "rt.entire_place",
      country: "España",
      city: "Madrid",
      timezone: "Europe/Madrid",
      maxGuests: 2,
      bedroomsCount: 1,
      bedsCount: 1,
      bathroomsCount: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects maxGuests below 1", () => {
    const result = basicsSchema.safeParse({
      propertyNickname: "Test",
      propertyType: "pt.house",
      roomType: "rt.entire_place",
      country: "España",
      city: "Madrid",
      timezone: "Europe/Madrid",
      maxGuests: 0,
      bedroomsCount: 1,
      bedsCount: 1,
      bathroomsCount: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("Arrival editor schema", () => {
  it("validates complete arrival data", () => {
    const result = arrivalSchema.safeParse({
      checkInStart: "16:00",
      checkInEnd: "22:00",
      checkOutTime: "11:00",
      primaryAccessMethod: "am.smart_lock",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional contact fields", () => {
    const result = arrivalSchema.safeParse({
      checkInStart: "14:00",
      checkInEnd: "20:00",
      checkOutTime: "10:00",
      primaryAccessMethod: "am.lockbox",
      hostContactPhone: "+34600000000",
      supportContact: "Equipo Central",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing access method", () => {
    const result = arrivalSchema.safeParse({
      checkInStart: "16:00",
      checkInEnd: "22:00",
      checkOutTime: "11:00",
      primaryAccessMethod: "",
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
