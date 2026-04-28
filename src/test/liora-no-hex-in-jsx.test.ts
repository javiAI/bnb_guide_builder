import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walk } from "./utils/walk";

const ROOT = process.cwd();

// Files that legitimately contain hex color strings as data values (not JSX styling).
const ALLOWLISTED_FILES = new Set([
  "src/config/brand-palette.ts", // hex values are palette data, not inline styles
]);

// Patterns that constitute invalid hex usage in JSX/TSX.
// Applied against the full file content (not per-line) so multiline style/className
// blocks are caught (e.g. style={{ color: "#fff" }} spread across multiple lines).
const PATTERNS = [
  {
    // style prop containing a hex literal inside its braces.
    // (?:[^}]|\{[^}]*\})* matches the JSX object value ({{}}) without
    // crossing the closing }} — prevents false positives from HTML entities
    // like &#9660 that appear after the style prop in the same file.
    regex: /style=\{(?:[^}]|\{[^}]*\})*#[0-9a-fA-F]{3,8}/,
    label: "style prop with hex color literal",
  },
  {
    // Tailwind arbitrary value bg-[#xxx] / text-[#xxx] etc., possibly across lines
    regex: /className[\s\S]*?(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]/,
    label: "Tailwind arbitrary value with hex color",
  },
];

describe("liora-no-hex-in-jsx", () => {
  it("no TSX/TS file uses hex literals in style props or Tailwind arbitrary values", () => {
    const violations: { file: string; label: string; match: string }[] = [];
    const EXCLUDE = [join(ROOT, "src/test/"), join(ROOT, "src/lib/types/")];

    for (const f of walk(join(ROOT, "src"), [".ts", ".tsx"])) {
      if (EXCLUDE.some((ex) => f.startsWith(ex))) continue;
      const rel = f.replace(ROOT + "/", "");
      if (ALLOWLISTED_FILES.has(rel)) continue;

      const content = readFileSync(f, "utf8");
      for (const { regex, label } of PATTERNS) {
        if (regex.test(content)) {
          violations.push({ file: rel, label, match: (content.match(regex) ?? [""])[0].trim().slice(0, 120) });
        }
      }
    }

    const report = violations
      .map((v) => `  ${v.file}  [${v.label}]\n    ${v.match}`)
      .join("\n");

    expect(
      violations,
      `Hex color literals in JSX/TS found:\n${report}\n` +
        "Use var(--color-*) semantic tokens or Tailwind color utilities instead.",
    ).toEqual([]);
  });
});
