import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();

// Files that legitimately contain hex color strings as data values (not JSX styling).
const ALLOWLISTED_FILES = new Set([
  "src/config/brand-palette.ts", // hex values are palette data, not inline styles
]);

// Patterns that constitute invalid hex usage in JSX/TSX:
//   (a) style={{ ... }} with a literal hex color value
//   (b) className with a Tailwind arbitrary value bg-[#xxx] / text-[#xxx]
const PATTERNS = [
  {
    regex: /style=\{[^}]*#[0-9a-fA-F]{3,8}/,
    label: "style prop with hex color literal",
  },
  {
    regex: /className[^>]*(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]/,
    label: "Tailwind arbitrary value with hex color",
  },
];

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

describe("liora-no-hex-in-jsx", () => {
  it("no TSX/TS file uses hex literals in style props or Tailwind arbitrary values", () => {
    const violations: { file: string; line: number; label: string; text: string }[] = [];
    const EXCLUDE = [join(ROOT, "src/test/"), join(ROOT, "src/lib/types/")];

    for (const f of walk(join(ROOT, "src"), [".ts", ".tsx"])) {
      if (EXCLUDE.some((ex) => f.startsWith(ex))) continue;
      const rel = f.replace(ROOT + "/", "");
      if (ALLOWLISTED_FILES.has(rel)) continue;

      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const { regex, label } of PATTERNS) {
          if (regex.test(line)) {
            violations.push({ file: rel, line: i + 1, label, text: line.trim() });
          }
        }
      });
    }

    const report = violations
      .map((v) => `  ${v.file}:${v.line}  [${v.label}]\n    ${v.text}`)
      .join("\n");

    expect(
      violations,
      `Hex color literals in JSX/TS found:\n${report}\n` +
        "Use var(--color-*) semantic tokens or Tailwind color utilities instead.",
    ).toEqual([]);
  });
});
