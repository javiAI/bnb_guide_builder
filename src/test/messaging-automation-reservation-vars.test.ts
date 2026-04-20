// Threading a reservation through resolveVariables lifts the 4 reservation
// vars from `unresolved_context` to `resolved` — proves the 12B resolver
// upgrade + context plumbing.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { propertyMock, contactMock, amenityMock, knowledgeMock } = vi.hoisted(
  () => ({
    propertyMock: vi.fn<(args: unknown) => Promise<unknown>>(),
    contactMock: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    amenityMock: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    knowledgeMock: vi.fn<(args: unknown) => Promise<unknown[]>>(),
  }),
);

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUniqueOrThrow: propertyMock },
    contact: { findMany: contactMock },
    propertyAmenityInstance: { findMany: amenityMock },
    knowledgeItem: { findMany: knowledgeMock },
  },
}));

import { resolveVariables } from "@/lib/services/messaging-variables.service";

const FIXTURE_PROPERTY = {
  id: "p_1",
  propertyNickname: "Ático Malasaña",
  propertyType: "apartment",
  checkInStart: "16:00",
  checkInEnd: "20:00",
  checkOutTime: "11:00",
  city: "Madrid",
  country: "España",
  timezone: "Europe/Madrid",
  streetAddress: null,
  maxGuests: 4,
  publicSlug: "atico-malasana",
  accessMethodsJson: null,
  policiesJson: null,
  customAccessMethodDesc: null,
  primaryAccessMethod: null,
  defaultLocale: "es",
};

const BODY =
  "Hola {{guest_name}}, entras el {{check_in_date}} y sales el {{check_out_date}}. Sois {{num_guests}}.";

beforeEach(() => {
  propertyMock.mockReset();
  contactMock.mockReset();
  amenityMock.mockReset();
  knowledgeMock.mockReset();
  propertyMock.mockResolvedValue(FIXTURE_PROPERTY);
  contactMock.mockResolvedValue([]);
  amenityMock.mockResolvedValue([]);
  knowledgeMock.mockResolvedValue([]);
});

describe("reservation variable resolution", () => {
  it("without reservation: all 4 reservation vars are unresolved_context", async () => {
    const result = await resolveVariables("p_1", BODY);
    expect(result.unresolvedContext.sort()).toEqual(
      ["check_in_date", "check_out_date", "guest_name", "num_guests"].sort(),
    );
    expect(result.output).toContain("[Nombre del huésped]");
  });

  it("with reservation: the 4 tokens resolve and the output substitutes real data", async () => {
    const result = await resolveVariables("p_1", BODY, {
      reservation: {
        id: "r_1",
        guestName: "Ana García",
        checkInDate: new Date("2026-05-10T00:00:00Z"),
        checkOutDate: new Date("2026-05-13T00:00:00Z"),
        numGuests: 2,
        locale: "es",
      },
    });
    expect(result.resolved.sort()).toEqual(
      ["check_in_date", "check_out_date", "guest_name", "num_guests"].sort(),
    );
    expect(result.unresolvedContext).toHaveLength(0);
    expect(result.output).toContain("Ana García");
    expect(result.output).toContain("2");
    expect(result.output).toMatch(/10 de mayo/); // Intl es formatting
    expect(result.output).toMatch(/13 de mayo/);
  });

  it("falls back to property.defaultLocale when reservation.locale is null", async () => {
    const result = await resolveVariables("p_1", "Entras el {{check_in_date}}.", {
      reservation: {
        id: "r_1",
        guestName: "Ana",
        checkInDate: new Date("2026-05-10T00:00:00Z"),
        checkOutDate: new Date("2026-05-13T00:00:00Z"),
        numGuests: 2,
        locale: null,
      },
    });
    expect(result.resolved).toContain("check_in_date");
    // Spanish default: "10 de mayo"
    expect(result.output).toMatch(/10 de mayo/);
  });
});
