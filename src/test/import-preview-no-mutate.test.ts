import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Invariant gate scoped to preview code (Rama 14D + 15E).
 *
 * Everything under `src/lib/imports/**` is preview-only EXCEPT the applier
 * service introduced in 15E (`shared/import-applier.service.ts`), which is
 * the single authorized mutation point. Any other file gaining mutations
 * means we leaked DB writes into the preview pipeline.
 */

const APPLIER_WHITELIST = "shared/import-applier.service.ts";

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
  it("src/lib/imports/** contains zero Prisma mutation calls (except the applier)", () => {
    const root = join(process.cwd(), "src/lib/imports");
    const files = walk(root);
    expect(files.length).toBeGreaterThan(0);

    const offenders: Array<{ file: string; match: string }> = [];
    for (const file of files) {
      if (file.endsWith(APPLIER_WHITELIST)) continue;
      const text = readFileSync(file, "utf8");
      for (const pattern of MUTATION_PATTERNS) {
        const m = text.match(pattern);
        if (m) offenders.push({ file, match: m[0] });
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the Airbnb preview API route contains zero Prisma mutation calls", () => {
    const route = join(
      process.cwd(),
      "src/app/api/properties/[propertyId]/import/airbnb/preview/route.ts",
    );
    const text = readFileSync(route, "utf8");
    for (const pattern of MUTATION_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("the Booking preview API route contains zero Prisma mutation calls", () => {
    const route = join(
      process.cwd(),
      "src/app/api/properties/[propertyId]/import/booking/preview/route.ts",
    );
    const text = readFileSync(route, "utf8");
    for (const pattern of MUTATION_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });
});
