import { describe, it, expect } from "vitest";
import {
  incidentCategories,
  findIncidentCategory,
  isIncidentCategoryKey,
} from "@/lib/taxonomy-loader";

// Canonical `ic.<slug>` keys shipped with rama 13D. These drive the chips in
// the guest issue reporter and seed `Incident.categoryKey`. Locking them here
// prevents silent removal; adding a new one requires updating this list and
// any panel filter UI that renders the chip set.
const CANONICAL_INCIDENT_KEYS = [
  "ic.wifi",
  "ic.appliance",
  "ic.cleaning",
  "ic.noise",
  "ic.access",
  "ic.other",
] as const;

describe("incident_categories.json", () => {
  it("loads and exposes all canonical categories", () => {
    expect(incidentCategories.items.length).toBe(CANONICAL_INCIDENT_KEYS.length);
  });

  it("prefixes every id with `ic.`", () => {
    for (const item of incidentCategories.items) {
      expect(item.id).toMatch(/^ic\.[a-z_]+$/);
    }
  });

  it("has no duplicate ids", () => {
    const ids = incidentCategories.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships Spanish labels + guestLabel + icon + description", () => {
    for (const item of incidentCategories.items) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.guestLabel.trim().length).toBeGreaterThan(0);
      expect(item.icon.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(0);
      expect(item.label).not.toMatch(/^(todo|tbd|placeholder)/i);
    }
  });

  it("defaultSeverity is in {low, medium, high}", () => {
    for (const item of incidentCategories.items) {
      expect(["low", "medium", "high"]).toContain(item.defaultSeverity);
    }
  });

  it("defaultTargetType matches Incident.targetType domain", () => {
    const allowed = ["system", "amenity", "space", "access", "property"];
    for (const item of incidentCategories.items) {
      expect(allowed).toContain(item.defaultTargetType);
    }
  });

  it("exposes every canonical key", () => {
    for (const key of CANONICAL_INCIDENT_KEYS) {
      expect(findIncidentCategory(key), `missing ${key}`).toBeDefined();
    }
  });

  it("findIncidentCategory returns undefined for unknown ids", () => {
    expect(findIncidentCategory("ic.unknown_xyz")).toBeUndefined();
    expect(findIncidentCategory("wifi")).toBeUndefined();
  });

  it("isIncidentCategoryKey discriminates known vs unknown", () => {
    expect(isIncidentCategoryKey("ic.wifi")).toBe(true);
    expect(isIncidentCategoryKey("ic.other")).toBe(true);
    expect(isIncidentCategoryKey("wifi")).toBe(false);
    expect(isIncidentCategoryKey("")).toBe(false);
  });

  it("rejects cross-namespace leaks from other taxonomies", () => {
    expect(isIncidentCategoryKey("le.concert")).toBe(false);
    expect(isIncidentCategoryKey("lp.restaurant")).toBe(false);
    expect(isIncidentCategoryKey("am.wifi")).toBe(false);
  });
});
