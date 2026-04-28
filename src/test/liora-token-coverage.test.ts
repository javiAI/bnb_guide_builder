import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();

// CSS vars SET externally (not declared in any of our CSS files):
// next/font injects --font-{sans,serif,mono} on <html> via @font-face logic.
// --guide-brand-{light,dark} are injected inline via style prop in guide-renderer.tsx.
const EXTERNAL_VARS = new Set([
  "--font-sans",
  "--font-serif",
  "--font-mono",
  "--guide-brand-light",
  "--guide-brand-dark",
]);

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, exts, acc);
    else if (exts.includes(extname(entry))) acc.push(full);
  }
  return acc;
}

function extractDeclarations(content: string): Set<string> {
  const declared = new Set<string>();
  // Match CSS custom property declarations: --var-name:
  for (const m of content.matchAll(/(--[\w-]+)\s*:/g)) {
    declared.add(m[1]);
  }
  return declared;
}

function extractReferences(content: string): string[] {
  const refs: string[] = [];
  // Match var(--xxx) — capture only the var name, ignore fallback
  for (const m of content.matchAll(/var\(\s*(--[\w-]+)/g)) {
    refs.push(m[1]);
  }
  return refs;
}

describe("liora-token-coverage", () => {
  it("every var(--xxx) in src/ is declared in foundations, aliases, or app CSS", () => {
    // ── 1. Collect all declared CSS vars ──────────────────────────────────
    const declared = new Set<string>();

    // foundations token files
    const tokenDir = join(ROOT, "design-system/foundations/tokens");
    for (const f of walk(tokenDir, [".css"])) {
      for (const v of extractDeclarations(readFileSync(f, "utf8"))) {
        declared.add(v);
      }
    }

    // legacy aliases + globals.css (font bridge)
    for (const rel of [
      "src/styles/legacy-aliases.css",
      "src/app/globals.css",
    ]) {
      for (const v of extractDeclarations(
        readFileSync(join(ROOT, rel), "utf8"),
      )) {
        declared.add(v);
      }
    }

    // other CSS files in src/ (e.g. guide.css declares --guide-brand)
    for (const f of walk(join(ROOT, "src"), [".css"])) {
      for (const v of extractDeclarations(readFileSync(f, "utf8"))) {
        declared.add(v);
      }
    }

    // ── 2. Collect all var(--xxx) references in src/ ──────────────────────
    const EXCLUDE = [join(ROOT, "src/test/"), join(ROOT, "src/lib/types/")];
    const unknown: { file: string; var: string }[] = [];

    for (const f of walk(join(ROOT, "src"), [".ts", ".tsx", ".css"])) {
      if (EXCLUDE.some((ex) => f.startsWith(ex))) continue;
      const content = readFileSync(f, "utf8");
      for (const ref of extractReferences(content)) {
        if (!declared.has(ref) && !EXTERNAL_VARS.has(ref)) {
          unknown.push({ file: f.replace(ROOT + "/", ""), var: ref });
        }
      }
    }

    const report = unknown
      .map((u) => `  ${u.var}  (in ${u.file})`)
      .join("\n");

    expect(
      unknown,
      `Unknown CSS vars referenced in src/:\n${report}\n` +
        "Add to foundations/tokens/, legacy-aliases.css, or EXTERNAL_VARS allowlist.",
    ).toEqual([]);
  });
});
