import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SEMANTIC_CSS = readFileSync(
  join(ROOT, "design-system/foundations/tokens/semantic.css"),
  "utf8",
);

function extractColorVarsFromBlock(css: string, blockSelector: string): Set<string> {
  const start = css.indexOf(blockSelector);
  if (start === -1) return new Set();
  const openBrace = css.indexOf("{", start);
  if (openBrace === -1) return new Set();

  let depth = 0;
  let end = openBrace;
  for (let i = openBrace; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  const block = css.slice(openBrace, end);
  const vars = new Set<string>();
  for (const m of block.matchAll(/^\s+(--color-[\w-]+)\s*:/gm)) {
    vars.add(m[1]);
  }
  return vars;
}

function extractRootVars(css: string): Set<string> {
  return extractColorVarsFromBlock(css, ":root {");
}

const rootVars = extractRootVars(SEMANTIC_CSS);
const darkVars = extractColorVarsFromBlock(SEMANTIC_CSS, '[data-theme="dark"]');

const CORE_PREFIXES = [
  "--color-background-",
  "--color-text-",
  "--color-border-",
  "--color-action-primary",
  "--color-action-secondary",
  "--color-action-ghost",
  "--color-action-destructive",
  "--color-interactive-",
  "--color-status-",
  "--color-focus-ring",
  "--color-disabled-",
];

describe("dark-parity", () => {
  it("semantic.css has a :root block with color vars", () => {
    expect(rootVars.size).toBeGreaterThan(50);
  });

  it("semantic.css has a [data-theme=dark] block with color vars", () => {
    expect(darkVars.size).toBeGreaterThan(50);
  });

  it("all core semantic color groups have dark-mode overrides", () => {
    const missing: string[] = [];
    for (const v of rootVars) {
      const isCore = CORE_PREFIXES.some((p) => v.startsWith(p));
      if (isCore && !darkVars.has(v)) {
        missing.push(v);
      }
    }
    expect(
      missing,
      `Core color vars missing from [data-theme="dark"]:\n${missing.map((v) => `  ${v}`).join("\n")}\n` +
        "Add dark-mode bindings in design-system/foundations/tokens/semantic.css",
    ).toEqual([]);
  });

  it("dark block covers at least 80% of root color vars (overall parity)", () => {
    const covered = [...rootVars].filter((v) => darkVars.has(v)).length;
    const ratio = covered / rootVars.size;
    expect(
      ratio,
      `Only ${Math.round(ratio * 100)}% of root color vars are overridden in dark mode (need ≥80%).`,
    ).toBeGreaterThanOrEqual(0.8);
  });
});
