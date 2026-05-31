import { describe, it, expect } from "vitest";
import { WORKSPACE_NAV, NAV_GROUP_LABELS } from "@/lib/navigation";
import { SECTION_EDITORS } from "@/config/schemas/section-editors";

describe("Navigation", () => {
  it("has all visible workspace modules defined", () => {
    const keys = WORKSPACE_NAV.map((item) => item.key);
    expect(keys).toContain("overview");
    expect(keys).toContain("property");
    expect(keys).toContain("access");
    expect(keys).toContain("contacts");
    expect(keys).toContain("policies");
    expect(keys).toContain("spaces");
    expect(keys).toContain("amenities");
    expect(keys).toContain("troubleshooting");
    expect(keys).toContain("local-guide");
    expect(keys).toContain("knowledge");
    expect(keys).toContain("ai");
    expect(keys).toContain("messaging");
    expect(keys).toContain("publishing");
    expect(keys).toContain("ops");
    expect(keys).toContain("media");
    expect(keys).toContain("analytics");
    expect(keys).toContain("settings");
    expect(keys).toContain("reservations");
    expect(keys).toContain("incidents");
  });

  it("excludes hideFromNav sections from the sidebar (route kept, nav hidden)", () => {
    const keys = WORKSPACE_NAV.map((item) => item.key);
    // guest-guide is reached via "Vista huésped"; activity is folded under Configuración.
    expect(keys).not.toContain("guest-guide");
    expect(keys).not.toContain("activity");
    // …but they remain valid section editors with routes.
    const editorKeys = SECTION_EDITORS.map((s) => s.key);
    expect(editorKeys).toContain("guest-guide");
    expect(editorKeys).toContain("activity");
  });

  it("generates correct href for each nav item", () => {
    const overview = WORKSPACE_NAV.find((n) => n.key === "overview")!;
    expect(overview.href("prop_123")).toBe("/properties/prop_123");

    const property = WORKSPACE_NAV.find((n) => n.key === "property")!;
    expect(property.href("prop_123")).toBe("/properties/prop_123/property");
  });

  it("has all group labels in Spanish (value-chain groups)", () => {
    expect(NAV_GROUP_LABELS.content).toBe("Contenido");
    expect(NAV_GROUP_LABELS.assistant).toBe("Asistente");
    expect(NAV_GROUP_LABELS.publishing).toBe("Publicación");
    expect(NAV_GROUP_LABELS.operations).toBe("Operaciones");
  });

  it("every nav item belongs to a valid group", () => {
    const validGroups = ["content", "assistant", "publishing", "operations"];
    WORKSPACE_NAV.forEach((item) => {
      expect(validGroups).toContain(item.group);
    });
  });

  it("renders groups in value-chain order: Contenido → Asistente → Publicación → Operaciones", () => {
    const groupsInOrder: string[] = [];
    for (const item of WORKSPACE_NAV) {
      if (groupsInOrder[groupsInOrder.length - 1] !== item.group) {
        groupsInOrder.push(item.group);
      }
    }
    expect(groupsInOrder).toEqual(["content", "assistant", "publishing", "operations"]);
  });
});
