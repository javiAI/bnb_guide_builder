import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function readSource(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("liora page grammar — operator content modules", () => {
  it("access-form uses <PageHeader> at least once", () => {
    const src = readSource(
      "src/app/properties/[propertyId]/access/access-form.tsx",
    );
    expect(/<PageHeader[\s>]/.test(src)).toBe(true);
  });

  it("access-form uses <NumberedSection> at least once", () => {
    const src = readSource(
      "src/app/properties/[propertyId]/access/access-form.tsx",
    );
    expect(/<NumberedSection[\s>]/.test(src)).toBe(true);
  });
});
