import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildContextPrefix,
  buildBm25Text,
  buildContentHash,
  extractFromProperty,
  extractFromContacts,
  extractFromAmenities,
  extractFromSpaces,
  extractFromSystems,
  extractFromAccess,
  extractFromPolicies,
} from "@/lib/services/knowledge-extract.service";

// ── Prisma mock ──────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => {
  const property = {
    propertyNickname: "Apartamento Sol",
    propertyType: "pt.apartment",
    city: "Málaga",
    country: "España",
    checkInStart: "15:00",
    checkInEnd: "21:00",
    checkOutTime: "11:00",
    maxGuests: 4,
    maxAdults: 4,
    maxChildren: 2,
    infantsAllowed: true,
    isAutonomousCheckin: true,
    primaryAccessMethod: "am.lockbox",
    accessMethodsJson: {
      unit: { methods: ["am.lockbox"], customLabel: "Caja Azul" },
      building: null,
    },
    hasBuildingAccess: false,
    policiesJson: {
      smoking: "not_allowed",
      pets: { allowed: true, types: ["dogs", "cats"], maxCount: 1 },
      quietHours: { enabled: true, from: "22:00", to: "08:00" },
    },
  };

  const contacts = [
    {
      id: "contact_1",
      roleKey: "ct.host",
      displayName: "María García",
      phone: "+34600000001",
      whatsapp: "+34600000001",
      email: "maria@example.com",
      availabilitySchedule: "09:00-21:00",
      guestVisibleNotes: "Respondo en menos de 1 hora.",
      visibility: "guest",
      isPrimary: true,
      sortOrder: 0,
    },
    {
      id: "contact_2",
      roleKey: "ct.cleaning",
      displayName: "Limpieza Express",
      phone: "+34600000002",
      whatsapp: null,
      email: null,
      availabilitySchedule: null,
      guestVisibleNotes: null,
      visibility: "internal",
      isPrimary: false,
      sortOrder: 1,
    },
  ];

  const amenities = [
    {
      id: "ami_1",
      amenityKey: "am.wifi",
      detailsJson: { network: "SolFi_5G" },
      guestInstructions: "Conéctate a SolFi_5G y usa la contraseña del tablón.",
      visibility: "guest",
    },
    {
      id: "ami_2",
      amenityKey: "am.washer",
      detailsJson: null,
      guestInstructions: null,
      visibility: "guest",
    },
    {
      id: "ami_3",
      amenityKey: "am.pool",
      detailsJson: { type: "outdoor" },
      guestInstructions: "El horario de la piscina es de 10:00 a 22:00.",
      visibility: "guest",
    },
    {
      id: "ami_4",
      amenityKey: "am.gym",
      detailsJson: null,
      guestInstructions: null,
      visibility: "ai",
    },
    {
      id: "ami_5",
      amenityKey: "am.free_parking",
      detailsJson: { type: "private" },
      guestInstructions: null,
      visibility: "guest",
    },
  ];

  const spaces = [
    {
      id: "space_1",
      spaceType: "sp.bedroom",
      name: "Habitación Principal",
      guestNotes: "Con vistas al mar.",
      visibility: "guest",
      beds: [{ bedType: "bt.king", quantity: 1 }],
    },
    {
      id: "space_2",
      spaceType: "sp.bathroom",
      name: "Baño Principal",
      guestNotes: null,
      visibility: "guest",
      beds: [],
    },
    {
      id: "space_3",
      spaceType: "sp.living_room",
      name: "Salón",
      guestNotes: "Con TV y sofá cama.",
      visibility: "guest",
      beds: [{ bedType: "bt.sofa_bed", quantity: 1 }],
    },
  ];

  const systems = [
    {
      id: "sys_1",
      systemKey: "sys.heating",
      detailsJson: { type: "radiators" },
      opsJson: { troubleshooting: "Si no calienta, revisa el termostato." },
      visibility: "guest",
    },
    {
      id: "sys_2",
      systemKey: "sys.internet",
      detailsJson: { provider: "Movistar" },
      opsJson: null,
      visibility: "guest",
    },
  ];

  const prismaMock = {
    property: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(property),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue(contacts),
    },
    propertyAmenityInstance: {
      findMany: vi.fn().mockResolvedValue(amenities),
    },
    space: {
      findMany: vi.fn().mockResolvedValue(spaces),
    },
    propertySystem: {
      findMany: vi.fn().mockResolvedValue(systems),
    },
  };
  return { prisma: prismaMock };
});

// ──────────────────────────────────────────────────────────────────────────────

describe("buildContextPrefix", () => {
  it("produces multi-line spec format", () => {
    const prefix = buildContextPrefix({
      propertyName: "Apartamento Sol",
      city: "Málaga",
      sectionLabel: "Esenciales",
      entityLabel: "WiFi",
      visibility: "guest",
      canonicalQuestion: "¿Cuál es la contraseña del WiFi?",
    });
    expect(prefix).toContain("Propiedad: Apartamento Sol, Málaga.");
    expect(prefix).toContain("Sección: Esenciales > WiFi.");
    expect(prefix).toContain("Destinado a: huéspedes durante la estancia.");
    expect(prefix).toContain("Sensibilidad: baja.");
    expect(prefix).toContain('Pregunta que responde: "¿Cuál es la contraseña del WiFi?"');
  });

  it("omits city when null", () => {
    const prefix = buildContextPrefix({
      propertyName: "Casa Rural",
      city: null,
      sectionLabel: "General",
      entityLabel: "Overview",
      visibility: "guest",
      canonicalQuestion: "¿Qué tipo de alojamiento es?",
    });
    expect(prefix).toContain("Propiedad: Casa Rural.");
    expect(prefix).not.toContain(", .");
  });

  it("uses correct labels for internal visibility", () => {
    const prefix = buildContextPrefix({
      propertyName: "Test",
      city: null,
      sectionLabel: "Contactos",
      entityLabel: "Limpieza",
      visibility: "internal",
      canonicalQuestion: "¿Quién limpia?",
    });
    expect(prefix).toContain("Destinado a: uso interno.");
    expect(prefix).toContain("Sensibilidad: alta.");
  });
});

describe("buildBm25Text", () => {
  it("lowercases and strips diacritics", () => {
    const result = buildBm25Text("Propiedad: Málaga.", "El check-in es a las 15:00.");
    expect(result).toContain("malaga");
    expect(result).toContain("check");
    expect(result).not.toContain("á");
  });

  it("removes common Spanish stopwords", () => {
    const result = buildBm25Text("", "El check-in es a las 15 en la propiedad.");
    expect(result).not.toContain(" el ");
    expect(result).not.toContain(" es ");
    expect(result).not.toContain(" la ");
    expect(result).not.toContain(" en ");
  });
});

describe("buildContentHash", () => {
  it("returns a deterministic 16-char hex string", () => {
    const h1 = buildContentHash("prefix", "body");
    const h2 = buildContentHash("prefix", "body");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(16);
    expect(h1).toMatch(/^[0-9a-f]+$/);
  });

  it("changes when content changes", () => {
    const h1 = buildContentHash("prefix", "body A");
    const h2 = buildContentHash("prefix", "body B");
    expect(h1).not.toBe(h2);
  });
});

describe("extractFromProperty", () => {
  it("emits checkin_time, checkout_time, capacity, overview chunks", async () => {
    const chunks = await extractFromProperty("prop_1");
    const types = chunks.map((c) => c.sourceFields.join(","));
    expect(types.some((t) => t.includes("checkInStart"))).toBe(true);
    expect(types.some((t) => t.includes("checkOutTime"))).toBe(true);
    expect(types.some((t) => t.includes("maxGuests"))).toBe(true);
    expect(types.some((t) => t.includes("propertyType"))).toBe(true);
  });

  it("all property chunks have entityType=property and entityId=null", async () => {
    const chunks = await extractFromProperty("prop_1");
    for (const c of chunks) {
      expect(c.entityType).toBe("property");
      expect(c.entityId).toBeNull();
      expect(c.chunkType).toBe("fact");
    }
  });

  it("all property chunks have journeyStage set", async () => {
    const chunks = await extractFromProperty("prop_1");
    for (const c of chunks) {
      expect(c.journeyStage).toBeTruthy();
    }
  });

  it("contextPrefix includes property name", async () => {
    const chunks = await extractFromProperty("prop_1");
    for (const c of chunks) {
      expect(c.contextPrefix).toContain("Apartamento Sol");
    }
  });

  it("bm25Text is non-empty and contains no raw taxonomy keys", async () => {
    const chunks = await extractFromProperty("prop_1");
    for (const c of chunks) {
      expect(c.bm25Text.length).toBeGreaterThan(5);
      expect(c.bm25Text).not.toMatch(/pt\.[a-z_]+/);
    }
  });
});

describe("extractFromContacts", () => {
  it("emits one chunk per contact", async () => {
    const chunks = await extractFromContacts("prop_1");
    expect(chunks).toHaveLength(2);
  });

  it("propagates visibility from source contact", async () => {
    const chunks = await extractFromContacts("prop_1");
    const guestChunk = chunks.find((c) => c.entityId === "contact_1");
    const internalChunk = chunks.find((c) => c.entityId === "contact_2");
    expect(guestChunk?.visibility).toBe("guest");
    expect(internalChunk?.visibility).toBe("internal");
  });

  it("all contact chunks have entityType=contact and entityId set", async () => {
    const chunks = await extractFromContacts("prop_1");
    for (const c of chunks) {
      expect(c.entityType).toBe("contact");
      expect(c.entityId).toBeTruthy();
      expect(c.chunkType).toBe("fact");
    }
  });
});

describe("extractFromAmenities", () => {
  it("emits existence chunk for each amenity, usage chunk when guestInstructions set", async () => {
    const chunks = await extractFromAmenities("prop_1");
    // 5 amenities: 3 with guestInstructions (wifi, pool), 2 without → 5 existence + 2 usage = 7
    // But ami_4 (gym) has visibility=ai with no guestInstructions → 1 existence
    // Actually: wifi+instructions, pool+instructions, gym(no instructions), washing_machine(no instructions), parking(no instructions)
    // Wait: wifi has instructions, pool has instructions → 5 existence + 2 usage = 7
    const existenceChunks = chunks.filter((c) => c.chunkType === "fact");
    const usageChunks = chunks.filter((c) => c.chunkType === "procedure");
    expect(existenceChunks).toHaveLength(5);
    expect(usageChunks).toHaveLength(2);
  });

  it("propagates visibility from amenity instance", async () => {
    const chunks = await extractFromAmenities("prop_1");
    const gymChunk = chunks.find((c) => c.entityId === "ami_4");
    expect(gymChunk?.visibility).toBe("ai");
  });

  it("contextPrefix does not contain raw amenity keys", async () => {
    const chunks = await extractFromAmenities("prop_1");
    for (const c of chunks) {
      expect(c.contextPrefix).not.toMatch(/am\.[a-z_]+/);
    }
  });
});

describe("extractFromSpaces", () => {
  it("emits one chunk per space", async () => {
    const chunks = await extractFromSpaces("prop_1");
    expect(chunks).toHaveLength(3);
  });

  it("includes bed summary in bodyMd when beds present", async () => {
    const chunks = await extractFromSpaces("prop_1");
    const bedroomChunk = chunks.find((c) => c.entityId === "space_1");
    expect(bedroomChunk?.bodyMd).toContain("bt.king");
  });

  it("all space chunks have entityType=space, chunkType=fact", async () => {
    const chunks = await extractFromSpaces("prop_1");
    for (const c of chunks) {
      expect(c.entityType).toBe("space");
      expect(c.chunkType).toBe("fact");
      expect(c.entityId).toBeTruthy();
    }
  });
});

describe("extractFromSystems", () => {
  it("emits description + troubleshooting when opsJson has content", async () => {
    const chunks = await extractFromSystems("prop_1");
    const heatingChunks = chunks.filter((c) => c.entityId === "sys_1");
    expect(heatingChunks.some((c) => c.chunkType === "fact")).toBe(true);
    expect(heatingChunks.some((c) => c.chunkType === "troubleshooting")).toBe(true);
  });

  it("emits only description chunk when opsJson is null", async () => {
    const chunks = await extractFromSystems("prop_1");
    const internetChunks = chunks.filter((c) => c.entityId === "sys_2");
    expect(internetChunks).toHaveLength(1);
    expect(internetChunks[0].chunkType).toBe("fact");
  });
});

describe("extractFromAccess", () => {
  it("emits unit_access and checkin_logistics chunks", async () => {
    const chunks = await extractFromAccess("prop_1");
    const topics = chunks.map((c) => c.topic);
    expect(topics).toContain("Acceso a la unidad");
    expect(topics).toContain("Logística de llegada");
  });

  it("does not emit building_access when hasBuildingAccess=false", async () => {
    const chunks = await extractFromAccess("prop_1");
    const buildingChunk = chunks.find((c) => c.topic === "Acceso al edificio");
    expect(buildingChunk).toBeUndefined();
  });

  it("all access chunks have visibility=guest", async () => {
    const chunks = await extractFromAccess("prop_1");
    for (const c of chunks) {
      expect(c.visibility).toBe("guest");
    }
  });
});

describe("extractFromPolicies", () => {
  it("emits smoking, pets, children and quiet hours chunks", async () => {
    const chunks = await extractFromPolicies("prop_1");
    const topics = chunks.map((c) => c.topic);
    expect(topics).toContain("Política de fumadores");
    expect(topics).toContain("Política de mascotas");
    expect(topics).toContain("Política sobre niños");
    expect(topics).toContain("Horario de silencio");
  });

  it("all policy chunks have chunkType=policy, entityType=policy, entityId=null", async () => {
    const chunks = await extractFromPolicies("prop_1");
    for (const c of chunks) {
      expect(c.chunkType).toBe("policy");
      expect(c.entityType).toBe("policy");
      expect(c.entityId).toBeNull();
    }
  });
});
