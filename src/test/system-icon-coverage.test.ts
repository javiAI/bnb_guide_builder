import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAllSystemItems } from "@/lib/taxonomy-loader";
import { SYSTEM_ICONS, systemIconFor, SYSTEM_FALLBACK_ICON } from "@/lib/icons/system-icons";

const ROOT = resolve(__dirname, "../..");
function readSource(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("system-icons coverage", () => {
  it("SYSTEM_ICONS keys === system_taxonomy.json item ids", () => {
    const taxonomyIds = getAllSystemItems()
      .map((i) => i.id)
      .sort();
    const iconKeys = Object.keys(SYSTEM_ICONS).sort();
    expect(iconKeys).toEqual(taxonomyIds);
  });

  it("every taxonomy system resolves to a defined icon", () => {
    for (const item of getAllSystemItems()) {
      expect(SYSTEM_ICONS[item.id]).toBeTruthy();
    }
  });

  it("systemIconFor returns the fallback for unknown keys", () => {
    expect(systemIconFor("sys.__unknown__")).toBe(SYSTEM_FALLBACK_ICON);
  });
});

describe("systems page grammar (Liora 16E.5)", () => {
  it("systems list page uses <PageHeader> + <NumberedSection>", () => {
    const src = readSource("src/app/properties/[propertyId]/systems/page.tsx");
    expect(/<PageHeader[\s>]/.test(src)).toBe(true);
    expect(/<NumberedSection[\s>]/.test(src)).toBe(true);
  });

  it("system detail page uses <PageHeader>", () => {
    const src = readSource(
      "src/app/properties/[propertyId]/systems/[systemId]/page.tsx",
    );
    expect(/<PageHeader[\s>]/.test(src)).toBe(true);
  });
});
