import { describe, it, expect } from "vitest";
import {
  resolveFieldDependencies,
  getAllTriggers,
  getAllDependentFields,
} from "@/config/schemas/field-dependencies";
import {
  getMediaRequirementsForSection,
  getRecommendedMedia,
  validateSectionMedia,
} from "@/config/registries/media-registry";
import {
  troubleshootingTaxonomy,
  getItems,
  findSubtype,
  amenityTaxonomy,
  getAmenityGroups,
  getAmenityGroupItems,
} from "@/lib/taxonomy-loader";
import {
  createPlaybookSchema,
  updatePlaybookSchema,
  createLocalPlaceSchema,
  updateLocalPlaceSchema,
  assignMediaSchema,
} from "@/lib/schemas/editor.schema";

// ── Rule engine follow-ups ──

describe("Rule engine follow-up fields", () => {
  it("smart lock shows lock-specific fields", () => {
    const deps = resolveFieldDependencies({
      "arrival.access.method": "am.smart_lock",
    });
    expect(deps.visibleFields.has("lock.brand")).toBe(true);
    expect(deps.visibleFields.has("lock.model")).toBe(true);
    expect(deps.visibleFields.has("access.credentials.type")).toBe(true);
    expect(deps.defaults["access.backup_method"]).toBe("am.lockbox");
  });

  it("lockbox shows location and photo fields", () => {
    const deps = resolveFieldDependencies({
      "arrival.access.method": "am.lockbox",
    });
    expect(deps.visibleFields.has("lockbox.location_desc")).toBe(true);
    expect(deps.visibleFields.has("arrival.media.lockbox")).toBe(true);
  });

  it("wifi amenity shows credential fields", () => {
    const deps = resolveFieldDependencies({
      "amenities.selected": ["am.wifi"],
    });
    expect(deps.visibleFields.has("wifi.ssid")).toBe(true);
    expect(deps.visibleFields.has("wifi.password")).toBe(true);
  });

  it("coffee maker shows subtype fields", () => {
    const deps = resolveFieldDependencies({
      "amenities.selected": ["am.coffee_maker"],
    });
    expect(deps.visibleFields.has("coffee_maker.subtype")).toBe(true);
    expect(deps.defaults["coffee_maker.subtype"]).toBe("drip");
  });

  it("multiple triggers resolve independently", () => {
    const deps = resolveFieldDependencies({
      "arrival.access.method": "am.smart_lock",
      "amenities.selected": ["am.wifi"],
    });
    expect(deps.visibleFields.has("lock.brand")).toBe(true);
    expect(deps.visibleFields.has("wifi.ssid")).toBe(true);
    expect(deps.matchedRules.length).toBeGreaterThanOrEqual(2);
  });

  it("parking amenities trigger parking fields", () => {
    const deps = resolveFieldDependencies({
      "amenities.selected": ["am.free_parking"],
    });
    expect(deps.visibleFields.has("parking.type")).toBe(true);
    expect(deps.visibleFields.has("parking.location")).toBe(true);
  });

  it("hidden field cleanup is detected", () => {
    // Building staff fields
    const deps1 = resolveFieldDependencies({
      "arrival.access.method": "am.building_staff",
    });
    expect(deps1.visibleFields.has("staff.hours")).toBe(true);
    expect(deps1.visibleFields.has("lock.brand")).toBe(false);

    // Switching to smart lock should make staff fields disappear
    const deps2 = resolveFieldDependencies({
      "arrival.access.method": "am.smart_lock",
    });
    expect(deps2.visibleFields.has("staff.hours")).toBe(false);
    expect(deps2.visibleFields.has("lock.brand")).toBe(true);
  });
});

// ── Amenity subtypes ──

describe("Amenity subtype configuration", () => {
  it("wifi has subtype with credential fields", () => {
    const subtype = findSubtype("am.wifi");
    expect(subtype).toBeDefined();
    const fieldIds = subtype!.fields.map((f) => f.id);
    expect(fieldIds.length).toBeGreaterThan(0);
  });

  it("coffee_maker has subtype with type selection", () => {
    const subtype = findSubtype("am.coffee_maker");
    expect(subtype).toBeDefined();
    const typeField = subtype!.fields.find((f) =>
      f.id.includes("type") || f.id.includes("system"),
    );
    expect(typeField).toBeDefined();
  });

  it("amenity groups have non-empty items", () => {
    const groups = getAmenityGroups(amenityTaxonomy);
    for (const group of groups) {
      const items = getAmenityGroupItems(amenityTaxonomy, group.id);
      expect(items.length).toBeGreaterThan(0);
    }
  });
});

// ── Troubleshooting schemas ──

describe("Troubleshooting schemas", () => {
  it("troubleshooting taxonomy has items", () => {
    const items = getItems(troubleshootingTaxonomy);
    expect(items.length).toBeGreaterThan(0);
  });

  it("createPlaybookSchema validates required fields", () => {
    const valid = createPlaybookSchema.safeParse({
      playbookKey: "tr.lockout",
      title: "Huésped no puede entrar",
    });
    expect(valid.success).toBe(true);

    const invalid = createPlaybookSchema.safeParse({
      playbookKey: "",
      title: "",
    });
    expect(invalid.success).toBe(false);
  });

  it("updatePlaybookSchema accepts all fields", () => {
    const result = updatePlaybookSchema.safeParse({
      title: "Cerradura no responde",
      severity: "high",
      symptomsMd: "El código no funciona",
      guestStepsMd: "1. Intentar de nuevo\n2. Llamar",
      internalStepsMd: "1. Reset remoto",
      escalationRule: "Técnico en 30 min",
      visibility: "ai",
    });
    expect(result.success).toBe(true);
  });
});

// ── Local guide schemas ──

describe("Local guide schemas", () => {
  it("createLocalPlaceSchema validates required fields", () => {
    const valid = createLocalPlaceSchema.safeParse({
      categoryKey: "lp.restaurant",
      name: "Bar El Rincón",
      distanceMeters: 200,
    });
    expect(valid.success).toBe(true);
  });

  it("uses metric units (meters)", () => {
    const valid = createLocalPlaceSchema.safeParse({
      categoryKey: "lp.supermarket",
      name: "Mercadona",
      distanceMeters: 500,
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.distanceMeters).toBe(500);
  });

  it("rejects categoryKey values missing the lp.* prefix", () => {
    const invalid = createLocalPlaceSchema.safeParse({
      categoryKey: "restaurant",
      name: "Bar",
    });
    expect(invalid.success).toBe(false);
  });

  it("updateLocalPlaceSchema accepts all optional fields", () => {
    const result = updateLocalPlaceSchema.safeParse({
      name: "Playa de la Malvarrosa",
      guestDescription: "A 5 minutos andando",
      bestFor: "Paseo y baño",
      seasonalNotes: "Mejor en verano",
      visibility: "guest",
    });
    expect(result.success).toBe(true);
  });
});

// ── Media schemas and registry ──

describe("Media asset schemas", () => {
  it("assignMediaSchema validates assignment data", () => {
    const valid = assignMediaSchema.safeParse({
      mediaAssetId: "asset_123",
      entityType: "space",
      entityId: "space_456",
    });
    expect(valid.success).toBe(true);
  });

  it("assignMediaSchema rejects unknown entityType", () => {
    const invalid = assignMediaSchema.safeParse({
      mediaAssetId: "asset_123",
      entityType: "unknown_entity",
      entityId: "id_456",
    });
    expect(invalid.success).toBe(false);
  });
});

describe("Media requirements from taxonomy", () => {
  it("arrival section has media requirements", () => {
    const reqs = getMediaRequirementsForSection("arrival");
    expect(reqs.length).toBeGreaterThan(0);
  });

  it("basics section has media requirements", () => {
    const reqs = getMediaRequirementsForSection("basics");
    expect(reqs.length).toBeGreaterThan(0);
  });

  it("recommended media is available", () => {
    const recommended = getRecommendedMedia();
    expect(recommended.length).toBeGreaterThan(0);
  });

  it("validateSectionMedia tracks completeness", () => {
    const result = validateSectionMedia("arrival", []);
    expect(result).toHaveProperty("complete");
    expect(result).toHaveProperty("missing");
  });
});

// ── Triggers and dependent fields coverage ──

describe("Rule engine coverage", () => {
  it("has triggers for access methods, amenities, policies, and publishing", () => {
    const triggers = getAllTriggers();
    expect(triggers).toContain("arrival.access.method");
    expect(triggers).toContain("amenities.selected");
    expect(triggers).toContain("pol.pets.allowed");
  });

  it("has dependent fields across multiple domains", () => {
    const fields = getAllDependentFields();
    // Access fields
    expect(fields).toContain("lock.brand");
    // Amenity fields
    expect(fields).toContain("wifi.ssid");
    // Policy fields
    expect(fields).toContain("pol.pets.max");
    // Parking fields
    expect(fields).toContain("parking.type");
  });
});
