import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const ALIASES_PATH = join(ROOT, "src/styles/legacy-aliases.css");
const ADOPTION_PLAN_PATH = join(ROOT, "docs/LIORA_DESIGN_ADOPTION_PLAN.md");

describe("liora-legacy-alias-registry", () => {
  const aliasSource = readFileSync(ALIASES_PATH, "utf8");
  const adoptionPlan = readFileSync(ADOPTION_PLAN_PATH, "utf8");

  // Extract all CSS custom property declarations from legacy-aliases.css
  // that look like: --some-var: <value>
  const lines = aliasSource.split("\n");
  const aliases: { name: string; line: number }[] = [];
  lines.forEach((line, i) => {
    const m = /^\s+(--[\w-]+)\s*:/.exec(line);
    if (m) aliases.push({ name: m[1], line: i + 1 });
  });

  it("legacy-aliases.css has at least one alias declared", () => {
    expect(aliases.length).toBeGreaterThan(0);
  });

  it("every alias has a @deprecated comment in the preceding lines", () => {
    const missing: string[] = [];
    for (const { name, line } of aliases) {
      // Look back up to 3 lines for a @deprecated comment
      const window = lines
        .slice(Math.max(0, line - 4), line - 1)
        .join(" ");
      if (!window.includes("@deprecated")) {
        missing.push(`  --${name.replace("--", "")} (line ${line})`);
      }
    }
    expect(
      missing,
      `Aliases missing @deprecated comment:\n${missing.join("\n")}\n` +
        "Add /* @deprecated removed in 16G — use <semantic> */ above each alias.",
    ).toEqual([]);
  });

  it("every alias is documented in LIORA_DESIGN_ADOPTION_PLAN.md", () => {
    const undocumented: string[] = [];
    for (const { name } of aliases) {
      if (!adoptionPlan.includes(name)) {
        undocumented.push(`  ${name}`);
      }
    }
    expect(
      undocumented,
      `Aliases missing from docs/LIORA_DESIGN_ADOPTION_PLAN.md:\n${undocumented.join("\n")}\n` +
        "Add each alias to the registry table in §2.",
    ).toEqual([]);
  });

  it("registry is not empty (16G cleanup gate)", () => {
    // This test should be UPDATED to expect [] in 16G after all aliases are removed.
    // Until then, it simply asserts that the file exists and has content.
    expect(aliases.length).toBeGreaterThan(0);
  });
});
