import { describe, it, expect } from "vitest";
import {
  assignMediaSchema,
  reorderMediaSchema,
  VALID_ENTITY_TYPES,
} from "@/lib/schemas/editor.schema";

// ── Schema validation ──

describe("assignMediaSchema", () => {
  it("accepts valid assignment data", () => {
    const result = assignMediaSchema.safeParse({
      mediaAssetId: "asset_123",
      entityType: "space",
      entityId: "space_456",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional usageKey", () => {
    const result = assignMediaSchema.safeParse({
      mediaAssetId: "asset_123",
      entityType: "property",
      entityId: "prop_456",
      usageKey: "cover",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usageKey).toBe("cover");
    }
  });

  it("rejects unknown entityType", () => {
    const result = assignMediaSchema.safeParse({
      mediaAssetId: "asset_123",
      entityType: "unknown_entity",
      entityId: "id_456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty mediaAssetId", () => {
    const result = assignMediaSchema.safeParse({
      mediaAssetId: "",
      entityType: "space",
      entityId: "space_456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty entityId", () => {
    const result = assignMediaSchema.safeParse({
      mediaAssetId: "asset_123",
      entityType: "space",
      entityId: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid entity types", () => {
    for (const entityType of VALID_ENTITY_TYPES) {
      const result = assignMediaSchema.safeParse({
        mediaAssetId: "asset_123",
        entityType,
        entityId: "entity_456",
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("reorderMediaSchema", () => {
  it("accepts valid reorder data", () => {
    const result = reorderMediaSchema.safeParse({
      entityType: "space",
      entityId: "space_123",
      orderedAssignmentIds: ["a1", "a2", "a3"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty orderedAssignmentIds", () => {
    const result = reorderMediaSchema.safeParse({
      entityType: "space",
      entityId: "space_123",
      orderedAssignmentIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown entityType", () => {
    const result = reorderMediaSchema.safeParse({
      entityType: "invalid",
      entityId: "space_123",
      orderedAssignmentIds: ["a1"],
    });
    expect(result.success).toBe(false);
  });
});

// ── VALID_ENTITY_TYPES constant ──

describe("VALID_ENTITY_TYPES", () => {
  it("contains the expected entity types", () => {
    expect(VALID_ENTITY_TYPES).toContain("property");
    expect(VALID_ENTITY_TYPES).toContain("space");
    expect(VALID_ENTITY_TYPES).toContain("access_method");
    expect(VALID_ENTITY_TYPES).toContain("amenity_instance");
    expect(VALID_ENTITY_TYPES).toContain("system");
  });

  it("does not include local_place yet (deferred to phase 13)", () => {
    expect(VALID_ENTITY_TYPES).not.toContain("local_place");
  });

  it("has exactly 5 entries", () => {
    expect(VALID_ENTITY_TYPES).toHaveLength(5);
  });
});
