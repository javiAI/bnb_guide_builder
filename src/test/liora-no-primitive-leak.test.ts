import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();

// Primitive token prefixes defined only in design-system/foundations/tokens/primitives.css.
// Application code (src/**) must consume semantic tokens — never primitives directly.
const PRIMITIVE_PATTERN =
  /var\(\s*--(warm|olive|terra|info|gray|success|warning|error)-\d+/;

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

describe("liora-no-primitive-leak", () => {
  it("no src/ file references foundations primitive vars directly", () => {
    const leaks: { file: string; line: number; match: string }[] = [];

    for (const f of walk(join(ROOT, "src"), [".ts", ".tsx", ".css"])) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        const m = PRIMITIVE_PATTERN.exec(line);
        if (m) {
          leaks.push({
            file: f.replace(ROOT + "/", ""),
            line: i + 1,
            match: m[0],
          });
        }
      });
    }

    const report = leaks
      .map((l) => `  ${l.file}:${l.line}  ${l.match}`)
      .join("\n");

    expect(
      leaks,
      `Primitive token references found in src/:\n${report}\n` +
        "Use semantic tokens (--color-*, --shadow-*, etc.) or component tokens instead.",
    ).toEqual([]);
  });
});
