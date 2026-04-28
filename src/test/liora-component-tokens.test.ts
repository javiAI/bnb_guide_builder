import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walk } from "./utils/walk";

const ROOT = process.cwd();

// Primitive CSS var prefixes that must never appear in component files.
// These are the raw palette tokens from primitives.css — components must
// consume semantic (--color-*) or component (--button-*, --input-*, etc.) tokens.
const PRIMITIVE_PATTERN =
  /var\(\s*--(warm|olive|terra|info|gray|success|warning|error)-\d+/;

// Hex color literals in any context (not just JSX style props).
// Broader than liora-no-hex-in-jsx which only checks style={} and Tailwind [#...].
const HEX_LITERAL_PATTERN = /(?<![#\w-])#[0-9a-fA-F]{3,8}\b/;

describe("liora-component-tokens", () => {
  it("src/components/ui/ files use only semantic/component tokens — no primitives or hex literals", () => {
    const violations: { file: string; line: number; issue: string; match: string }[] = [];

    const uiDir = join(ROOT, "src/components/ui");
    for (const f of walk(uiDir, [".tsx", ".ts"])) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        const primitiveMatch = PRIMITIVE_PATTERN.exec(line);
        if (primitiveMatch) {
          violations.push({
            file: f.replace(ROOT + "/", ""),
            line: i + 1,
            issue: "primitive CSS var",
            match: primitiveMatch[0],
          });
        }

        const hexMatch = HEX_LITERAL_PATTERN.exec(line);
        if (hexMatch) {
          violations.push({
            file: f.replace(ROOT + "/", ""),
            line: i + 1,
            issue: "hex literal",
            match: hexMatch[0],
          });
        }
      });
    }

    const report = violations
      .map((v) => `  ${v.file}:${v.line}  [${v.issue}]  ${v.match}`)
      .join("\n");

    expect(
      violations,
      `Token contract violations in src/components/ui/:\n${report}\n` +
        "Use semantic tokens (--color-*, --shadow-*, etc.) or component tokens (--button-*, --input-*, etc.).",
    ).toEqual([]);
  });
});
