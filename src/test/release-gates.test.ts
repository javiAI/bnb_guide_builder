import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { RENDER_CONFIGS } from "@/config/registries/renderer-registry";
import { SECTION_EDITORS } from "@/config/schemas/section-editors";

/**
 * Release gate tests — verify spec compliance without running the app.
 */

describe("Canonical screens exist", () => {
  const appDir = path.resolve(__dirname, "../app");

  const canonicalRoutes = [
    "",
    "properties/new/welcome",
    "properties/new/step-1",
    "properties/new/step-2",
    "properties/new/step-3",
    "properties/new/step-4",
    "properties/new/review",
    "properties/[propertyId]",
    "properties/[propertyId]/basics",
    "properties/[propertyId]/arrival",
    "properties/[propertyId]/policies",
    "properties/[propertyId]/spaces",
    "properties/[propertyId]/spaces/[spaceId]",
    "properties/[propertyId]/amenities",
    "properties/[propertyId]/amenities/[amenityId]",
    "properties/[propertyId]/troubleshooting",
    "properties/[propertyId]/troubleshooting/[playbookKey]",
    "properties/[propertyId]/local-guide",
    "properties/[propertyId]/knowledge",
    "properties/[propertyId]/guest-guide",
    "properties/[propertyId]/ai",
    "properties/[propertyId]/messaging",
    "properties/[propertyId]/messaging/[touchpointKey]",
    "properties/[propertyId]/publishing",
    "properties/[propertyId]/ops",
    "properties/[propertyId]/media",
    "properties/[propertyId]/analytics",
    "properties/[propertyId]/settings",
    "properties/[propertyId]/activity",
  ];

  for (const route of canonicalRoutes) {
    it(`route ${route || "/"} has page.tsx`, () => {
      const pagePath = path.join(appDir, route, "page.tsx");
      expect(fs.existsSync(pagePath)).toBe(true);
    });
  }
});

describe("No secret in render configs", () => {
  it("no render config allows secret visibility", () => {
    for (const config of RENDER_CONFIGS) {
      expect(config.maxVisibility).not.toBe("secret");
    }
  });
});

describe("All section editors have labels", () => {
  it("no empty labels in section editors", () => {
    for (const section of SECTION_EDITORS) {
      expect(section.label.length).toBeGreaterThan(0);
    }
  });
});

describe("Taxonomy JSON files exist", () => {
  const taxonomyDir = path.resolve(__dirname, "../../taxonomies");
  const requiredFiles = [
    "property_types.json",
    "room_types.json",
    "space_types.json",
    "access_methods.json",
    "policy_taxonomy.json",
    "amenity_taxonomy.json",
    "amenity_subtypes.json",
    "troubleshooting_taxonomy.json",
    "messaging_touchpoints.json",
    "guide_outputs.json",
    "visibility_levels.json",
    "media_requirements.json",
    "dynamic_field_rules.json",
    "automation_channels.json",
    "media_asset_roles.json",
    "review_reasons.json",
  ];

  for (const file of requiredFiles) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(taxonomyDir, file))).toBe(true);
    });
  }
});

describe("API routes exist", () => {
  const apiDir = path.resolve(__dirname, "../app/api");

  const apiRoutes = [
    "properties/[propertyId]/assistant/ask",
    "properties/[propertyId]/assistant/debug/retrieve",
    "properties/[propertyId]/assistant/conversations",
    "assistant-conversations/[conversationId]/messages",
  ];

  for (const route of apiRoutes) {
    it(`API route ${route} has route.ts`, () => {
      const routePath = path.join(apiDir, route, "route.ts");
      expect(fs.existsSync(routePath)).toBe(true);
    });
  }
});
