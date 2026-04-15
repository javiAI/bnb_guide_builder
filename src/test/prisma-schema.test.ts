import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const schema = readFileSync(
  join(process.cwd(), "prisma/schema.prisma"),
  "utf-8",
);

describe("Prisma schema completeness", () => {
  const requiredModels = [
    "Workspace",
    "User",
    "WorkspaceMembership",
    "Property",
    "WizardSession",
    "WizardResponse",
    "Space",
    "PropertyAmenityInstance",
    "PropertyAmenityPlacement",
    "TroubleshootingPlaybook",
    "LocalPlace",
    "OpsChecklistItem",
    "StockItem",
    "MaintenanceTask",
    "MediaAsset",
    "MediaAssignment",
    "KnowledgeSource",
    "KnowledgeItem",
    "KnowledgeCitation",
    "Intent",
    "GuideVersion",
    "GuideSection",
    "GuideSectionItem",
    "MessageTemplate",
    "MessageAutomation",
    "MessageDraft",
    "AssistantConversation",
    "AssistantMessage",
    "SecretReference",
    "AuditLog",
  ];

  requiredModels.forEach((model) => {
    it(`defines model ${model}`, () => {
      expect(schema).toContain(`model ${model} {`);
    });
  });

  it("uses PostgreSQL as datasource", () => {
    expect(schema).toContain('provider = "postgresql"');
  });

  it("Space has visibility column", () => {
    const spaceBlock = schema.split("model Space {")[1]?.split("}")[0];
    expect(spaceBlock).toContain("visibility");
  });

  it("LocalPlace uses distanceMeters (metric)", () => {
    const block = schema.split("model LocalPlace {")[1]?.split("}")[0];
    expect(block).toContain("distanceMeters");
    expect(block).not.toContain("distanceMiles");
    expect(block).not.toContain("distanceFeet");
  });

  it("OpsChecklistItem uses estimatedMinutes (metric time)", () => {
    const block = schema.split("model OpsChecklistItem {")[1]?.split("}")[0];
    expect(block).toContain("estimatedMinutes");
  });

  it("SecretReference exists and is property-scoped", () => {
    const block = schema.split("model SecretReference {")[1]?.split("}")[0];
    expect(block).toContain("propertyId");
    expect(block).toContain("vaultKey");
  });

  it("AuditLog is append-only (no updatedAt)", () => {
    const block = schema.split("model AuditLog {")[1]?.split("}")[0];
    expect(block).toContain("createdAt");
    expect(block).not.toContain("updatedAt");
  });
});
