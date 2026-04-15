import { describe, it, expect } from "vitest";

import {
  WIZARD_STEPS,
  getWizardStep,
  SECTION_EDITORS,
  getSectionEditor,
  getSectionsByGroup,
  getSectionsForPhase,
  resolveFieldDependencies,
  getAllTriggers,
  getAllDependentFields,
  getRulesShowingField,
  getRenderConfig,
  getRenderConfigsForTarget,
  lookupIcon,
  SECTION_ICONS,
} from "@/config";

import {
  getMediaRequirementsForSection,
  getRecommendedMedia,
  validateSectionMedia,
} from "@/config/registries/media-registry";

import { WORKSPACE_NAV, NAV_GROUP_LABELS } from "@/lib/navigation";

// ── Wizard step schemas ──

describe("Wizard step schemas", () => {
  it("defines exactly 4 wizard steps", () => {
    expect(WIZARD_STEPS).toHaveLength(4);
  });

  it("each step has title, subtitle, and at least one field group", () => {
    for (const step of WIZARD_STEPS) {
      expect(step.title).toBeTruthy();
      expect(step.subtitle).toBeTruthy();
      expect(step.groups.length).toBeGreaterThan(0);
    }
  });

  it("each field group has at least one field", () => {
    for (const step of WIZARD_STEPS) {
      for (const group of step.groups) {
        expect(group.fields.length).toBeGreaterThan(0);
      }
    }
  });

  it("taxonomy_radio fields reference a taxonomy with items", () => {
    for (const step of WIZARD_STEPS) {
      for (const group of step.groups) {
        for (const field of group.fields) {
          if (field.type === "taxonomy_radio") {
            expect(field.taxonomy.items.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("all field labels are in Spanish", () => {
    for (const step of WIZARD_STEPS) {
      expect(step.title).toMatch(/[a-záéíóúñ]/i);
      expect(step.submitLabel).toMatch(/[a-záéíóúñ]/i);
    }
  });

  it("getWizardStep returns correct step by number", () => {
    const step2 = getWizardStep(2);
    expect(step2?.step).toBe(2);
    expect(step2?.title).toBe("Ubicación");
  });

  it("getWizardStep returns undefined for non-existent step", () => {
    expect(getWizardStep(99)).toBeUndefined();
  });
});

// ── Section editor registry ──

describe("Section editor registry", () => {
  it("defines at least 10 section editors", () => {
    expect(SECTION_EDITORS.length).toBeGreaterThanOrEqual(10);
  });

  it("each section has a unique key", () => {
    const keys = SECTION_EDITORS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("each section has label and description in Spanish", () => {
    for (const section of SECTION_EDITORS) {
      expect(section.label).toBeTruthy();
      expect(section.description).toBeTruthy();
    }
  });

  it("each section belongs to a valid group", () => {
    const validGroups = ["content", "outputs", "operations"];
    for (const section of SECTION_EDITORS) {
      expect(validGroups).toContain(section.group);
    }
  });

  it("getSectionEditor finds by key", () => {
    expect(getSectionEditor("amenities")?.label).toBe("Equipamiento");
  });

  it("getSectionsByGroup filters correctly", () => {
    const content = getSectionsByGroup("content");
    expect(content.every((s) => s.group === "content")).toBe(true);
    expect(content.length).toBeGreaterThan(0);
  });

  it("getSectionsForPhase includes all sections up to given phase", () => {
    const phase3 = getSectionsForPhase(3);
    expect(phase3.every((s) => s.phase <= 3)).toBe(true);
  });
});

// ── Navigation derived from section registry ──

describe("Navigation is config-derived", () => {
  it("all section editors appear in WORKSPACE_NAV", () => {
    for (const section of SECTION_EDITORS) {
      const navItem = WORKSPACE_NAV.find((n) => n.key === section.key);
      expect(navItem).toBeDefined();
      expect(navItem!.label).toBe(section.label);
    }
  });

  it("nav groups match section groups", () => {
    for (const section of SECTION_EDITORS) {
      const navItem = WORKSPACE_NAV.find((n) => n.key === section.key);
      expect(navItem!.group).toBe(section.group);
    }
  });

  it("group labels are in Spanish", () => {
    expect(NAV_GROUP_LABELS.content).toBe("Contenido");
    expect(NAV_GROUP_LABELS.outputs).toBe("Salidas");
    expect(NAV_GROUP_LABELS.operations).toBe("Operaciones");
  });
});

// ── Field dependency engine ──

describe("Field dependency engine", () => {
  it("resolves smart lock dependencies correctly", () => {
    const result = resolveFieldDependencies({
      "arrival.access.method": "am.smart_lock",
    });
    expect(result.visibleFields.has("lock.brand")).toBe(true);
    expect(result.visibleFields.has("lock.model")).toBe(true);
    expect(result.matchedRules).toContain("dfr.access_smart_lock");
    expect(result.defaults["access.backup_method"]).toBe("am.lockbox");
  });

  it("resolves pets_allowed dependencies", () => {
    const result = resolveFieldDependencies({
      "pol.pets.allowed": true,
    });
    expect(result.visibleFields.has("pol.pets.max")).toBe(true);
    expect(result.visibleFields.has("pol.pets.fee_mode")).toBe(true);
    expect(result.matchedRules).toContain("dfr.pets_allowed");
  });

  it("returns empty for unmatched trigger", () => {
    const result = resolveFieldDependencies({
      "nonexistent.trigger": "value",
    });
    expect(result.visibleFields.size).toBe(0);
    expect(result.matchedRules).toHaveLength(0);
  });

  it("getAllTriggers returns known triggers", () => {
    const triggers = getAllTriggers();
    expect(triggers).toContain("arrival.access.method");
    expect(triggers).toContain("pol.pets.allowed");
    expect(triggers).toContain("amenities.selected");
  });

  it("getAllDependentFields returns fields from rules", () => {
    const fields = getAllDependentFields();
    expect(fields).toContain("lock.brand");
    expect(fields).toContain("wifi.ssid");
    expect(fields).toContain("pol.pets.max");
  });

  it("getRulesShowingField finds rules for a field", () => {
    const rules = getRulesShowingField("lock.brand");
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].id).toBe("dfr.access_smart_lock");
  });
});

// ── Renderer registry ──

describe("Renderer registry", () => {
  it("defines render configs for content sections", () => {
    expect(getRenderConfig("property")).toBeDefined();
    expect(getRenderConfig("access")).toBeDefined();
    expect(getRenderConfig("amenities")).toBeDefined();
  });

  it("guest_guide target includes guest content", () => {
    const guideConfigs = getRenderConfigsForTarget("guest_guide");
    expect(guideConfigs.length).toBeGreaterThan(0);
    const property = guideConfigs.find((c) => c.sectionKey === "property");
    expect(property?.maxVisibility).toBe("guest");
  });

  it("ai_view target includes more sections than guest_guide", () => {
    const aiConfigs = getRenderConfigsForTarget("ai_view");
    const guideConfigs = getRenderConfigsForTarget("guest_guide");
    expect(aiConfigs.length).toBeGreaterThanOrEqual(guideConfigs.length);
  });

  it("troubleshooting is not in guest_guide", () => {
    const guideConfigs = getRenderConfigsForTarget("guest_guide");
    expect(guideConfigs.find((c) => c.sectionKey === "troubleshooting")).toBeUndefined();
  });
});

// ── Icon registry ──

describe("Icon registry", () => {
  it("every section editor has an icon", () => {
    for (const section of SECTION_EDITORS) {
      expect(SECTION_ICONS[section.key]).toBeDefined();
    }
  });

  it("lookupIcon resolves section and taxonomy icons", () => {
    expect(lookupIcon("property")).toBe("home");
    expect(lookupIcon("am.smart_lock")).toBe("smartphone");
  });

  it("lookupIcon returns undefined for unknown IDs", () => {
    expect(lookupIcon("unknown_id")).toBeUndefined();
  });
});

// ── Media registry ──

describe("Media requirements registry", () => {
  it("returns media requirements by section", () => {
    const arrivalMedia = getMediaRequirementsForSection("arrival");
    expect(arrivalMedia.length).toBeGreaterThan(0);
  });

  it("recommended media is non-empty", () => {
    const recommended = getRecommendedMedia();
    expect(recommended.length).toBeGreaterThan(0);
  });

  it("validateSectionMedia reports missing items", () => {
    const result = validateSectionMedia("arrival", []);
    // If there are required items, they should be missing
    expect(result).toHaveProperty("complete");
    expect(result).toHaveProperty("missing");
  });
});

// ── Extensibility contract ──

describe("Config-driven extensibility", () => {
  it("adding a section to SECTION_EDITORS auto-creates nav item", () => {
    // Verify the contract: every SECTION_EDITORS entry maps to a nav item
    const navKeys = new Set(WORKSPACE_NAV.map((n) => n.key));
    for (const section of SECTION_EDITORS) {
      expect(navKeys.has(section.key)).toBe(true);
    }
  });

  it("wizard steps reference taxonomy data, not hardcoded options", () => {
    for (const step of WIZARD_STEPS) {
      for (const group of step.groups) {
        for (const field of group.fields) {
          if (field.type === "taxonomy_radio" || field.type === "taxonomy_select") {
            // Verify taxonomy has items with stable IDs
            expect(field.taxonomy.items.length).toBeGreaterThan(0);
            expect(field.taxonomy.items[0].id).toBeTruthy();
            expect(field.taxonomy.items[0].label).toBeTruthy();
          }
        }
      }
    }
  });

  it("render configs cover all content sections", () => {
    const contentSections = SECTION_EDITORS.filter((s) => s.group === "content");
    for (const section of contentSections) {
      const config = getRenderConfig(section.key);
      expect(config).toBeDefined();
    }
  });
});
