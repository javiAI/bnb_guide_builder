import { describe, it, expect } from "vitest";
import {
  createChecklistItemSchema,
  createStockItemSchema,
  createMaintenanceTaskSchema,
} from "@/lib/schemas/ops.schema";
import { reviewReasons, getItems } from "@/lib/taxonomy-loader";
import { SECTION_EDITORS, getSectionsByGroup } from "@/config/schemas/section-editors";

describe("Ops checklist schema", () => {
  it("rejects empty scopeKey", () => {
    const result = createChecklistItemSchema.safeParse({
      scopeKey: "",
      title: "Cambiar sábanas",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createChecklistItemSchema.safeParse({
      scopeKey: "turnover",
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid checklist item", () => {
    const result = createChecklistItemSchema.safeParse({
      scopeKey: "turnover",
      title: "Limpiar baño",
      estimatedMinutes: 15,
      required: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("Ops stock schema", () => {
  it("rejects empty name", () => {
    const result = createStockItemSchema.safeParse({
      categoryKey: "toiletries",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid stock item", () => {
    const result = createStockItemSchema.safeParse({
      categoryKey: "cleaning",
      name: "Lejía",
      restockThreshold: 3,
      unitLabel: "litros",
    });
    expect(result.success).toBe(true);
  });
});

describe("Ops maintenance schema", () => {
  it("rejects empty taskType", () => {
    const result = createMaintenanceTaskSchema.safeParse({
      taskType: "",
      title: "Revisar caldera",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid maintenance task", () => {
    const result = createMaintenanceTaskSchema.safeParse({
      taskType: "hvac",
      title: "Revisión anual climatización",
      cadenceKey: "annual",
      nextDueAt: "2026-06-01",
    });
    expect(result.success).toBe(true);
  });
});

describe("Review reasons taxonomy", () => {
  it("has at least 5 review reasons", () => {
    const items = getItems(reviewReasons);
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it("includes stale_content, low_confidence, missing_media", () => {
    const items = getItems(reviewReasons);
    const ids = items.map((i) => i.id);
    expect(ids).toContain("stale_content");
    expect(ids).toContain("low_confidence");
    expect(ids).toContain("missing_media");
  });

  it("includes publish_blocker and visibility_mismatch", () => {
    const items = getItems(reviewReasons);
    const ids = items.map((i) => i.id);
    expect(ids).toContain("publish_blocker");
    expect(ids).toContain("visibility_mismatch");
  });
});

describe("Section editors used in analytics", () => {
  it("content group has at least 6 sections", () => {
    const content = getSectionsByGroup("content");
    expect(content.length).toBeGreaterThanOrEqual(6);
  });

  it("all section editors have key and label", () => {
    for (const section of SECTION_EDITORS) {
      expect(section.key).toBeTruthy();
      expect(section.label).toBeTruthy();
    }
  });
});
