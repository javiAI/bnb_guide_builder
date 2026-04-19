import { describe, it, expect, vi } from "vitest";
import {
  extractFromProperty,
  extractFromContacts,
  buildContextPrefix,
  buildBm25Text,
} from "@/lib/services/knowledge-extract.service";

// Verify that extractors produce locale-correct content when called with
// locale="en", and that locale-scoped helpers behave correctly.

const { baseProperty } = vi.hoisted(() => ({
  baseProperty: {
    propertyNickname: "Casa del Sol",
    propertyType: "pt.apartment",
    city: "Madrid",
    country: "Spain",
    checkInStart: "15:00",
    checkInEnd: "21:00",
    checkOutTime: "11:00",
    maxGuests: 4,
    maxAdults: 4,
    maxChildren: 0,
    infantsAllowed: false,
    isAutonomousCheckin: false,
    primaryAccessMethod: "am.lockbox",
    accessMethodsJson: { unit: { methods: ["am.lockbox"] }, building: null },
    hasBuildingAccess: false,
    policiesJson: { smoking: "not_allowed" },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(baseProperty),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "c1",
          roleKey: "ct.host",
          displayName: "Ana García",
          phone: "+34600000001",
          whatsapp: null,
          email: null,
          availabilitySchedule: null,
          guestVisibleNotes: null,
          visibility: "guest",
          isPrimary: true,
          sortOrder: 0,
        },
      ]),
    },
    propertyAmenityInstance: { findMany: vi.fn().mockResolvedValue([]) },
    space: { findMany: vi.fn().mockResolvedValue([]) },
    propertySystem: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

describe("extractFromProperty — en locale", () => {
  it("checkin_time chunk is in English when locale=en", async () => {
    const chunks = await extractFromProperty("prop_1", "en");
    const checkinChunk = chunks.find((c) => c.sourceFields.includes("checkInStart"));
    expect(checkinChunk).toBeDefined();
    expect(checkinChunk?.bodyMd).toContain("Check-in");
    expect(checkinChunk?.bodyMd).not.toContain("check-in en");
  });

  it("checkout_time chunk is in English when locale=en", async () => {
    const chunks = await extractFromProperty("prop_1", "en");
    const checkoutChunk = chunks.find((c) => c.sourceFields.includes("checkOutTime"));
    expect(checkoutChunk).toBeDefined();
    expect(checkoutChunk?.bodyMd).toContain("11:00");
    expect(checkoutChunk?.bodyMd.toLowerCase()).toMatch(/check.out/);
  });

  it("all en chunks have locale=en", async () => {
    const chunks = await extractFromProperty("prop_1", "en");
    for (const c of chunks) {
      expect(c.locale).toBe("en");
    }
  });

  it("contextPrefix is in English for locale=en", async () => {
    const chunks = await extractFromProperty("prop_1", "en");
    for (const c of chunks) {
      expect(c.contextPrefix).toMatch(/^Property:/);
      expect(c.contextPrefix).not.toMatch(/^Propiedad:/);
    }
  });
});

describe("extractFromContacts — en locale", () => {
  it("contact chunk uses English labels in contextPrefix", async () => {
    const chunks = await extractFromContacts("prop_1", "en");
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.contextPrefix).toContain("Section: Contacts");
      expect(c.contextPrefix).not.toContain("Sección: Contactos");
    }
  });

  it("contact chunk has locale=en", async () => {
    const chunks = await extractFromContacts("prop_1", "en");
    for (const c of chunks) {
      expect(c.locale).toBe("en");
    }
  });
});

describe("buildContextPrefix — locale-aware", () => {
  it("produces Spanish prefix for locale=es", () => {
    const prefix = buildContextPrefix({
      propertyName: "Test",
      city: "Madrid",
      sectionLabel: "General",
      entityLabel: "Overview",
      visibility: "guest",
      canonicalQuestion: "¿Qué es?",
      locale: "es",
    });
    expect(prefix).toContain("Propiedad: Test");
    expect(prefix).toContain("Sección: General");
    expect(prefix).toContain("Destinado a:");
    expect(prefix).toContain("Sensibilidad:");
  });

  it("produces English prefix for locale=en", () => {
    const prefix = buildContextPrefix({
      propertyName: "Test",
      city: "Madrid",
      sectionLabel: "General",
      entityLabel: "Overview",
      visibility: "guest",
      canonicalQuestion: "What is it?",
      locale: "en",
    });
    expect(prefix).toContain("Property: Test");
    expect(prefix).toContain("Section: General");
    expect(prefix).toContain("Intended for:");
    expect(prefix).toContain("Sensitivity:");
    expect(prefix).not.toContain("Propiedad:");
  });

  it("falls back to Spanish prefix when locale omitted", () => {
    const prefix = buildContextPrefix({
      propertyName: "Test",
      city: null,
      sectionLabel: "General",
      entityLabel: "Overview",
      visibility: "guest",
      canonicalQuestion: "¿Qué es?",
    });
    expect(prefix).toContain("Propiedad: Test.");
  });
});

describe("buildBm25Text — locale-aware stopwords", () => {
  it("filters Spanish stopwords for locale=es", () => {
    const result = buildBm25Text("Propiedad: Test.", "El check-in es a las 15:00 en la casa.", "es");
    const tokens = result.split(/\s+/);
    expect(tokens).not.toContain("el");
    expect(tokens).not.toContain("es");
    expect(tokens).not.toContain("la");
  });

  it("filters English stopwords for locale=en", () => {
    const result = buildBm25Text("Property: Test.", "The check-in is at 15:00 in the apartment.", "en");
    const tokens = result.split(/\s+/);
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("is");
    expect(tokens).not.toContain("in");
  });

  it("keeps content words regardless of locale", () => {
    const esResult = buildBm25Text("", "checkin calefaccion wifi");
    expect(esResult).toContain("checkin");

    const enResult = buildBm25Text("", "checkin heating wifi", "en");
    expect(enResult).toContain("checkin");
    expect(enResult).toContain("heating");
    expect(enResult).toContain("wifi");
  });
});
