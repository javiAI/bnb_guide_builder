import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Invariant gate for Rama 14D preview-only contract.
 *
 * `src/lib/imports/**` must never contain calls that mutate DB state. The
 * preview endpoint reads (loadPropertyContext) and computes a diff; apply is
 * out of scope (14D). This test enforces that contract at the source level so
 * a future change that adds a mutation call without the proper apply design
 * round-trips through a loud CI failure.
 */

const MUTATION_PATTERNS = [
  /prisma\.[a-zA-Z_]+\.create\b/,
  /prisma\.[a-zA-Z_]+\.createMany\b/,
  /prisma\.[a-zA-Z_]+\.update\b/,
  /prisma\.[a-zA-Z_]+\.updateMany\b/,
  /prisma\.[a-zA-Z_]+\.upsert\b/,
  /prisma\.[a-zA-Z_]+\.delete\b/,
  /prisma\.[a-zA-Z_]+\.deleteMany\b/,
  /\$executeRaw/,
  /\$executeRawUnsafe/,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("import preview — no-mutate invariants", () => {
  it("src/lib/imports/** contains zero Prisma mutation calls", () => {
    const files = walk(join(process.cwd(), "src/lib/imports"));
    expect(files.length).toBeGreaterThan(0);

    const offenders: Array<{ file: string; match: string }> = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of MUTATION_PATTERNS) {
        const m = text.match(pattern);
        if (m) offenders.push({ file, match: m[0] });
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the preview API route contains zero Prisma mutation calls", () => {
    const route = join(
      process.cwd(),
      "src/app/api/properties/[propertyId]/import/airbnb/preview/route.ts",
    );
    const text = readFileSync(route, "utf8");
    for (const pattern of MUTATION_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });
});
