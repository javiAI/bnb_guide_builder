import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walk } from "./utils/walk";

const ROOT = process.cwd();

// Tailwind built-in color palette names.
// Matches color utility classes like bg-red-600, text-gray-900, border-slate-200.
// Does NOT match:
//   - Tailwind arbitrary values: bg-[var(--color-*)]
//   - Non-color utilities: text-sm, ring-2, border (without color), shadow-sm
//   - Custom scales in var(): var(--color-neutral-500) — has no class prefix
const COLOR_NAMES = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime",
  "green", "emerald", "teal", "cyan", "sky",
  "blue", "indigo", "violet", "purple", "fuchsia",
  "pink", "rose",
].join("|");

// Matches: (bg|text|border|ring|...)-<named-color>-<scale>
// The \b word boundary prevents matching inside CSS var names like --color-neutral-500
// (those start with -- so the word boundary before the prefix won't fire).
const TAILWIND_COLOR_PATTERN = new RegExp(
  `\\b(bg|text|border|ring|fill|stroke|from|to|via)-(${COLOR_NAMES})-(\\d{2,3})\\b`,
);

describe("liora-no-tailwind-named-color", () => {
  it("src/components/ui/ files use no Tailwind built-in named color utilities", () => {
    const violations: { file: string; line: number; match: string }[] = [];

    const uiDir = join(ROOT, "src/components/ui");
    for (const f of walk(uiDir, [".tsx", ".ts"])) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        const m = TAILWIND_COLOR_PATTERN.exec(line);
        if (m) {
          violations.push({
            file: f.replace(ROOT + "/", ""),
            line: i + 1,
            match: m[0],
          });
        }
      });
    }

    const report = violations
      .map((v) => `  ${v.file}:${v.line}  ${v.match}`)
      .join("\n");

    expect(
      violations,
      `Tailwind built-in named colors in src/components/ui/:\n${report}\n` +
        "Use var(--color-*) semantic tokens or component tokens instead of Tailwind palette utilities.",
    ).toEqual([]);
  });
});
