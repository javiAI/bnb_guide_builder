import { describe, it, expect } from "vitest";
import * as repos from "@/lib/repositories";

describe("Repository exports", () => {
  const expectedRepos = [
    "propertyRepository",
    "workspaceRepository",
    "wizardRepository",
    "spaceRepository",
    "amenityRepository",
    "troubleshootingRepository",
    "localPlaceRepository",
    "opsRepository",
    "mediaRepository",
    "knowledgeRepository",
    "guideRepository",
    "messagingRepository",
    "assistantRepository",
    "auditRepository",
  ];

  expectedRepos.forEach((name) => {
    it(`exports ${name}`, () => {
      expect(repos).toHaveProperty(name);
      expect(typeof (repos as Record<string, unknown>)[name]).toBe("object");
    });
  });
});

describe("Write ownership", () => {
  it("propertyRepository is write owner for property basics", () => {
    expect(repos.propertyRepository).toHaveProperty("create");
    expect(repos.propertyRepository).toHaveProperty("update");
  });

  it("spaceRepository is write owner for spaces", () => {
    expect(repos.spaceRepository).toHaveProperty("create");
    expect(repos.spaceRepository).toHaveProperty("update");
    expect(repos.spaceRepository).toHaveProperty("findByProperty");
  });

  it("amenityRepository is write owner for amenities", () => {
    expect(repos.amenityRepository).toHaveProperty("create");
    expect(repos.amenityRepository).toHaveProperty("update");
  });

  it("auditRepository is append-only (no update/delete)", () => {
    expect(repos.auditRepository).toHaveProperty("create");
    expect(repos.auditRepository).not.toHaveProperty("update");
    expect(repos.auditRepository).not.toHaveProperty("delete");
  });

  it("wizardRepository manages capture layer", () => {
    expect(repos.wizardRepository).toHaveProperty("createSession");
    expect(repos.wizardRepository).toHaveProperty("createResponse");
  });
});
