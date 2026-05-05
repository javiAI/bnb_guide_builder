import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Per-domain taxonomy modules under `src/lib/taxonomies/` are bundled with the
// client surfaces that import them (incident reporter, messaging editor, local
// places list, etc.). If any of them imports `@/lib/taxonomy-loader`, the full
// loader — with its ~30 eager taxonomy JSON imports — is dragged into the
// client chunk, defeating the per-domain split. This invariant fails fast in
// CI before the regression reaches a PR.

const TAXONOMIES_DIR = join(__dirname, "..", "lib", "taxonomies");

function listClientConsumableModules(): string[] {
  return readdirSync(TAXONOMIES_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(TAXONOMIES_DIR, f));
}

describe("per-domain taxonomy modules — bundle-split invariant", () => {
  const files = listClientConsumableModules();

  it("at least one per-domain module exists (sanity)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f]))(
    "%s does not import the central taxonomy-loader",
    (file) => {
      const source = readFileSync(file, "utf8");
      const offenders: string[] = [];
      const importLineRe =
        /^\s*(?:import|export)\s+[^;]*?from\s+["']([^"']+)["']/gm;
      for (const match of source.matchAll(importLineRe)) {
        const spec = match[1];
        if (
          spec === "@/lib/taxonomy-loader" ||
          spec === "../taxonomy-loader" ||
          spec === "./taxonomy-loader"
        ) {
          offenders.push(spec);
        }
      }
      expect(
        offenders,
        `${file} re-imports the central loader (${offenders.join(", ")}). ` +
          `That drags every taxonomy JSON into client bundles. Per-domain ` +
          `modules must own their own JSON import + Zod validation.`,
      ).toEqual([]);
    },
  );
});
