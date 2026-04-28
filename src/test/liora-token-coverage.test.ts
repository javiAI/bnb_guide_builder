import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { walk } from "./utils/walk";

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

function extractDeclarations(content: string): Set<string> {
  const declared = new Set<string>();
  for (const m of content.matchAll(/(--[\w-]+)\s*:/g)) {
    declared.add(m[1]);
  }
  return declared;
}

function extractReferences(content: string): string[] {
  const refs: string[] = [];
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

    // legacy aliases (font bridge now lives in design-system.css, picked up by src walk below)
    for (const v of extractDeclarations(
      readFileSync(join(ROOT, "src/styles/legacy-aliases.css"), "utf8"),
    )) {
      declared.add(v);
    }

    // ── 2. Walk src/ once; declarations first (phase A), references second (phase B) ──
    const EXCLUDE = [join(ROOT, "src/test/"), join(ROOT, "src/lib/types/")];
    const srcFiles = walk(join(ROOT, "src"), [".ts", ".tsx", ".css"]).filter(
      (f) => !EXCLUDE.some((ex) => f.startsWith(ex)),
    );

    // Phase A: collect declarations from remaining src CSS (e.g. guide.css declares --guide-brand)
    for (const f of srcFiles) {
      if (extname(f) === ".css") {
        for (const v of extractDeclarations(readFileSync(f, "utf8"))) {
          declared.add(v);
        }
      }
    }

    // Phase B: check all var(--xxx) references against the complete declared set
    const unknown: { file: string; var: string }[] = [];
    for (const f of srcFiles) {
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
