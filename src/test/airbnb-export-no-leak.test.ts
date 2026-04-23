import { describe, it, expect, vi, beforeEach } from "vitest";

// No-leak invariant (rama 14B): the Airbnb export must never carry
// internal- or sensitive-visibility data into the outbound payload. We
// enforce this at three layers and assert each one independently:
//
//   1. Prisma layer — the `findUnique` query for a property scopes related
//      `spaces` and `amenityInstances` to `visibility: "guest"`. If a future
//      refactor drops the filter, the test fails before any payload leaves
//      the function.
//   2. Schema layer — `airbnbListingPayloadSchema` is `.strict()`, so
//      unknown keys (e.g. `internalNotes`, `aiNotes`) cannot be serialized
//      even if a reducer tried. We exercise this with a synthetic draft.
//   3. Output layer — the JSON-serialized payload, given a fully populated
//      guest-visible context, contains none of the internal-visibility
//      sentinel substrings (case-insensitive).

const findUniqueMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import { serializeForAirbnb, buildAirbnbPayload } from "@/lib/exports/airbnb";
import { airbnbListingPayloadSchema } from "@/lib/schemas/airbnb-listing";
import type { PropertyExportContext } from "@/lib/exports/airbnb/engine";

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
      "ax.step_free_guest_entrance",
    ]),
    defaultLocale: "es",
  };
}

describe("Airbnb export — no leak (Prisma query layer)", () => {
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
    await serializeForAirbnb("test-property-id");
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
    await serializeForAirbnb("test-property-id");
    const args = findUniqueMock.mock.calls[0][0] as {
      select: {
        amenityInstances: { where: { visibility: string } };
      };
    };
    expect(args.select.amenityInstances.where.visibility).toBe("guest");
  });
});

describe("Airbnb export — no leak (schema layer)", () => {
  it("rejects unknown internal-shaped keys at Zod validation", () => {
    const malicious = {
      amenity_ids: [],
      internalNotes: "leaked operator memo",
      aiNotes: "leaked AI hint",
    };
    const parsed = airbnbListingPayloadSchema.safeParse(malicious);
    expect(parsed.success).toBe(false);
  });
});

describe("Airbnb export — no leak (output layer)", () => {
  it("serialized payload contains no internal-visibility sentinel substrings", () => {
    const { payload } = buildAirbnbPayload(fullyPopulatedGuestContext());
    const serialized = JSON.stringify(payload).toLowerCase();
    for (const token of INTERNAL_LEAK_TOKENS) {
      expect(
        serialized,
        `payload contains forbidden token "${token}"`,
      ).not.toContain(token);
    }
  });
});
