import { describe, it, expect, vi, beforeEach } from "vitest";

// No-leak invariant (rama 14C): the Booking export must never carry
// internal- or sensitive-visibility data into the outbound payload. Three
// layers, mirror of the Airbnb gate (rama 14B):
//
//   1. Prisma layer — `findUnique` scopes related `spaces` and
//      `amenityInstances` to `visibility: "guest"`.
//   2. Schema layer — `bookingListingPayloadSchema` is `.strict()`.
//   3. Output layer — serialized JSON contains no internal-visibility
//      sentinel substrings.

const findUniqueMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import { serializeForBooking, buildBookingPayload } from "@/lib/exports/booking";
import { bookingListingPayloadSchema } from "@/lib/schemas/booking-listing";
import type { PropertyExportContext } from "@/lib/exports/booking/engine";

const INTERNAL_LEAK_TOKENS = [
  "internalnotes",
  "internal_notes",
  "ainotes",
  "ai_notes",
  "sensitive",
  "internal",
];

function fullyPopulatedGuestContext(): PropertyExportContext {
  return {
    propertyType: "pt.house",
    customPropertyTypeLabel: null,
    bedroomsCount: 3,
    bathroomsCount: 2,
    personCapacity: 6,
    primaryAccessMethod: "am.smart_lock",
    customAccessMethodLabel: null,
    policiesJson: {
      quietHours: { enabled: true, from: "22:00", to: "08:00" },
      smoking: "not_allowed",
      events: { policy: "not_allowed" },
      commercialPhotography: "not_allowed",
      pets: { allowed: false },
      services: { allowed: true },
    },
    presentSpaceTypes: new Set(["sp.bedroom", "sp.bathroom", "sp.kitchen", "sp.living_room"]),
    spaceTypeCounts: {
      "sp.bedroom": 3,
      "sp.bathroom": 2,
      "sp.kitchen": 1,
      "sp.living_room": 1,
    },
    presentAmenityKeys: new Set([
      "am.wifi",
      "am.kitchen",
      "am.air_conditioning",
    ]),
    defaultLocale: "es",
  };
}

describe("Booking export — no leak (Prisma query layer)", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue({
      propertyType: null,
      customPropertyTypeLabel: null,
      bedroomsCount: null,
      bathroomsCount: null,
      maxGuests: 0,
      maxAdults: 0,
      maxChildren: 0,
      primaryAccessMethod: null,
      customAccessMethodLabel: null,
      policiesJson: null,
      defaultLocale: "es",
      spaces: [],
      amenityInstances: [],
    });
  });

  it("scopes spaces query to visibility:guest + status:active", async () => {
    await serializeForBooking("test-property-id");
    expect(findUniqueMock).toHaveBeenCalledTimes(1);
    const args = findUniqueMock.mock.calls[0][0] as {
      select: {
        spaces: { where: { visibility: string; status: string } };
      };
    };
    expect(args.select.spaces.where.visibility).toBe("guest");
    expect(args.select.spaces.where.status).toBe("active");
  });

  it("scopes amenityInstances query to visibility:guest", async () => {
    await serializeForBooking("test-property-id");
    const args = findUniqueMock.mock.calls[0][0] as {
      select: {
        amenityInstances: { where: { visibility: string } };
      };
    };
    expect(args.select.amenityInstances.where.visibility).toBe("guest");
  });
});

describe("Booking export — no leak (schema layer)", () => {
  it("rejects unknown internal-shaped keys at Zod validation", () => {
    const malicious = {
      amenity_ids: [],
      internalNotes: "leaked operator memo",
      aiNotes: "leaked AI hint",
    };
    const parsed = bookingListingPayloadSchema.safeParse(malicious);
    expect(parsed.success).toBe(false);
  });
});

describe("Booking export — no leak (output layer)", () => {
  it("serialized payload contains no internal-visibility sentinel substrings", () => {
    const { payload } = buildBookingPayload(fullyPopulatedGuestContext());
    const serialized = JSON.stringify(payload).toLowerCase();
    for (const token of INTERNAL_LEAK_TOKENS) {
      expect(
        serialized,
        `payload contains forbidden token "${token}"`,
      ).not.toContain(token);
    }
  });
});
