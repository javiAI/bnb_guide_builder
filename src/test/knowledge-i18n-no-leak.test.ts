import { describe, it, expect, vi } from "vitest";
import {
  extractFromContacts,
  extractFromAmenities,
  extractFromSpaces,
  extractFromSystems,
} from "@/lib/services/knowledge-extract.service";

// No-leak invariant: when extractors run with locale="en", generated topic +
// bodyMd must not contain Spanish phrases that would indicate a mixed-language
// chunk. These tests exercise the inline extractors (contacts/amenities/
// spaces/systems) that do not use the knowledge_templates.json file and
// therefore had the highest risk of leaking Spanish strings.

const SPANISH_LEAK_PATTERNS = [
  /\bTeléfono\b/,
  /\bDisponibilidad\b/,
  /\bContacto:/,
  /\bdispone de\b/,
  /\bes un\b/,
  /\bes una\b/,
  /\bCamas:/,
  /\bCómo usar:/,
  /\b¿/,
];

function assertNoSpanishLeak(text: string, fieldName: string) {
  for (const pattern of SPANISH_LEAK_PATTERNS) {
    expect(text, `${fieldName} leaked Spanish pattern ${pattern} in: ${text}`).not.toMatch(pattern);
  }
}

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        propertyNickname: "Casa del Sol",
        city: "Madrid",
      }),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "c1",
          roleKey: "ct.host",
          displayName: "Ana García",
          phone: "+34600000001",
          whatsapp: "+34600000002",
          email: "ana@example.com",
          availabilitySchedule: "Mon-Fri 9-18",
          guestVisibleNotes: null,
          visibility: "guest",
        },
      ]),
    },
    propertyAmenityInstance: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "a1",
          amenityKey: "am.wifi",
          detailsJson: { ssid: "CasaWifi", password: "secret" },
          guestInstructions: "Router is in the entry hall.",
          visibility: "guest",
        },
      ]),
    },
    space: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "s1",
          spaceType: "sp.bedroom",
          name: "Main bedroom",
          guestNotes: "Faces south.",
          visibility: "guest",
          beds: [{ bedType: "bt.double", quantity: 1 }],
        },
      ]),
    },
    propertySystem: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "sys1",
          systemKey: "sys.heating",
          detailsJson: { brand: "Saunier" },
          opsJson: { troubleshooting: "Press reset on the boiler." },
          visibility: "guest",
        },
      ]),
    },
  },
}));

describe("extractFromContacts — EN no-leak", () => {
  it("topic + bodyMd + contextPrefix are free of Spanish leak strings", async () => {
    const chunks = await extractFromContacts("prop_1", "en");
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      assertNoSpanishLeak(c.topic, "topic");
      assertNoSpanishLeak(c.bodyMd, "bodyMd");
      assertNoSpanishLeak(c.contextPrefix, "contextPrefix");
      expect(c.topic).toMatch(/^Contact:/);
      expect(c.bodyMd).toMatch(/Phone:/);
      expect(c.bodyMd).toMatch(/Availability:/);
      expect(c.templateKey).toBe("contact_info");
    }
  });
});

describe("extractFromAmenities — EN no-leak", () => {
  it("existence + usage chunks are free of Spanish leak strings", async () => {
    const chunks = await extractFromAmenities("prop_1", "en");
    expect(chunks.length).toBe(2); // existence + usage
    const templateKeys = chunks.map((c) => c.templateKey).sort();
    expect(templateKeys).toEqual(["amenity_existence", "amenity_usage"]);

    for (const c of chunks) {
      assertNoSpanishLeak(c.topic, "topic");
      assertNoSpanishLeak(c.bodyMd, "bodyMd");
      assertNoSpanishLeak(c.contextPrefix, "contextPrefix");
    }

    const existence = chunks.find((c) => c.templateKey === "amenity_existence")!;
    expect(existence.bodyMd).toMatch(/\bhas\b/);

    const usage = chunks.find((c) => c.templateKey === "amenity_usage")!;
    expect(usage.topic).toMatch(/^How to use:/);
  });
});

describe("extractFromSpaces — EN no-leak", () => {
  it("space bodyMd uses English bed/space phrasing", async () => {
    const chunks = await extractFromSpaces("prop_1", "en");
    expect(chunks.length).toBe(1);
    const c = chunks[0];
    assertNoSpanishLeak(c.topic, "topic");
    assertNoSpanishLeak(c.bodyMd, "bodyMd");
    assertNoSpanishLeak(c.contextPrefix, "contextPrefix");
    expect(c.bodyMd).toMatch(/\bis a\b/);
    expect(c.bodyMd).toMatch(/Beds:/);
    expect(c.templateKey).toBe("space_info");
  });
});

describe("extractFromSystems — EN no-leak", () => {
  it("system chunks are free of Spanish leak strings", async () => {
    const chunks = await extractFromSystems("prop_1", "en");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const c of chunks) {
      assertNoSpanishLeak(c.topic, "topic");
      assertNoSpanishLeak(c.bodyMd, "bodyMd");
      assertNoSpanishLeak(c.contextPrefix, "contextPrefix");
    }
    const desc = chunks.find((c) => c.templateKey === "system_info");
    expect(desc).toBeDefined();
    expect(desc!.bodyMd).toMatch(/\bhas\b/);
  });
});

describe("templateKey populated everywhere", () => {
  it("every inline-extracted chunk has a non-null templateKey", async () => {
    const all = (
      await Promise.all([
        extractFromContacts("prop_1", "en"),
        extractFromAmenities("prop_1", "en"),
        extractFromSpaces("prop_1", "en"),
        extractFromSystems("prop_1", "en"),
      ])
    ).flat();
    expect(all.length).toBeGreaterThan(0);
    for (const c of all) {
      expect(c.templateKey).toBeTypeOf("string");
      expect(c.templateKey.length).toBeGreaterThan(0);
    }
  });
});
