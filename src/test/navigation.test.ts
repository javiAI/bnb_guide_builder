import { describe, it, expect } from "vitest";
import { WORKSPACE_NAV, NAV_GROUP_LABELS } from "@/lib/navigation";

describe("Navigation", () => {
  it("has all workspace modules defined", () => {
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
    expect(keys).toContain("guest-guide");
    expect(keys).toContain("ai");
    expect(keys).toContain("messaging");
    expect(keys).toContain("publishing");
    expect(keys).toContain("ops");
    expect(keys).toContain("media");
    expect(keys).toContain("analytics");
    expect(keys).toContain("settings");
    expect(keys).toContain("activity");
  });

  it("generates correct href for each nav item", () => {
    const overview = WORKSPACE_NAV.find((n) => n.key === "overview")!;
    expect(overview.href("prop_123")).toBe("/properties/prop_123");

    const property = WORKSPACE_NAV.find((n) => n.key === "property")!;
    expect(property.href("prop_123")).toBe("/properties/prop_123/property");
  });

  it("has all group labels in Spanish", () => {
    expect(NAV_GROUP_LABELS.content).toBe("Contenido");
    expect(NAV_GROUP_LABELS.outputs).toBe("Salidas");
    expect(NAV_GROUP_LABELS.operations).toBe("Operaciones");
  });

  it("every nav item belongs to a valid group", () => {
    const validGroups = ["content", "outputs", "operations"];
    WORKSPACE_NAV.forEach((item) => {
      expect(validGroups).toContain(item.group);
    });
  });
});
