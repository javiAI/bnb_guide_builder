import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  createKnowledgeItemSchema,
  updateKnowledgeItemSchema,
  createGuideSectionItemSchema,
  updateGuideSectionSchema,
} from "@/lib/schemas/knowledge.schema";
import {
  getRenderConfigsForTarget,
  getRenderConfig,
  RENDER_CONFIGS,
} from "@/config/registries/renderer-registry";

describe("Knowledge schemas", () => {
  it("rejects empty topic", () => {
    const result = createKnowledgeItemSchema.safeParse({ topic: "", bodyMd: "content" });
    expect(result.success).toBe(false);
  });

  it("rejects empty bodyMd", () => {
    const result = createKnowledgeItemSchema.safeParse({ topic: "WiFi", bodyMd: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid knowledge item", () => {
    const result = createKnowledgeItemSchema.safeParse({
      topic: "WiFi",
      bodyMd: "La contraseña WiFi es...",
      visibility: "public",
      journeyStage: "during_stay",
    });
    expect(result.success).toBe(true);
  });

  it("update schema accepts confidenceScore", () => {
    const result = updateKnowledgeItemSchema.safeParse({
      topic: "Test",
      bodyMd: "Body",
      confidenceScore: 0.85,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confidenceScore).toBe(0.85);
    }
  });

  it("rejects confidenceScore out of range", () => {
    const result = updateKnowledgeItemSchema.safeParse({
      topic: "Test",
      bodyMd: "Body",
      confidenceScore: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("Guide section schemas", () => {
  it("rejects empty section title", () => {
    const result = updateGuideSectionSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty content in section item", () => {
    const result = createGuideSectionItemSchema.safeParse({ contentMd: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid section item", () => {
    const result = createGuideSectionItemSchema.safeParse({
      contentMd: "Bienvenido a tu alojamiento...",
      visibility: "public",
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("Renderer registry for guide/AI", () => {
  it("guest_guide target returns at least 5 sections", () => {
    const configs = getRenderConfigsForTarget("guest_guide");
    expect(configs.length).toBeGreaterThanOrEqual(5);
  });

  it("ai_view target includes renamed and new sections", () => {
    const configs = getRenderConfigsForTarget("ai_view");
    const keys = configs.map((c) => c.sectionKey);
    expect(keys).toContain("property");
    expect(keys).toContain("access");
    expect(keys).toContain("contacts");
    expect(configs.length).toBeGreaterThanOrEqual(7);
  });

  it("no section has secret as maxVisibility", () => {
    for (const config of RENDER_CONFIGS) {
      expect(config.maxVisibility).not.toBe("secret");
    }
  });

  it("each config with guest_guide target has guideSectionType", () => {
    const guideConfigs = getRenderConfigsForTarget("guest_guide");
    for (const config of guideConfigs) {
      expect(config.guideSectionType).toBeTruthy();
    }
  });

  it("getRenderConfig returns correct section", () => {
    const config = getRenderConfig("property");
    expect(config).toBeDefined();
    expect(config?.knowledgeCategory).toBe("property_info");
  });
});
