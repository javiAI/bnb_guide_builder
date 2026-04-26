import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Pins the wiring contract for operator-facing API routes (Rama 15D).
 *
 * Every `route.ts` under `src/app/api/properties/[propertyId]/...` MUST go
 * through `withOperatorGuards()` — that wrapper composes the three layers
 * (auth, ownership, per-actor rate limit). Adding a new route here without
 * the wrapper would skip rate limiting and accept unscoped propertyId.
 *
 * Escape hatch: a route can opt out by carrying a `// guards:manual <reason>`
 * marker. We grep for the marker; if the maintainer wants to bypass, the
 * reason is recorded next to the code.
 */

const ROOT = join(process.cwd(), "src/app/api/properties/[propertyId]");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (name === "route.ts") acc.push(full);
  }
  return acc;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const ROUTE_FILES = walk(ROOT);
const ROUTE_SOURCES: ReadonlyMap<string, string> = new Map(
  ROUTE_FILES.map((f) => [f, stripComments(readFileSync(f, "utf-8"))]),
);

describe("operator route coverage invariant", () => {
  it("every route.ts under properties/[propertyId] uses withOperatorGuards or marks guards:manual", () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const [file, src] of ROUTE_SOURCES) {
      const usesWrapper = /withOperatorGuards\b/.test(src);
      const manual = /guards:manual\s+\S+/.test(src);
      if (!usesWrapper && !manual) offenders.push(file);
    }

    expect(
      offenders,
      [
        "Routes without withOperatorGuards (and no `// guards:manual` opt-out):",
        ...offenders.map((f) => `  - ${f.replace(process.cwd() + "/", "")}`),
      ].join("\n"),
    ).toEqual([]);
  });

  it("all guarded routes declare a rateLimit bucket", () => {
    const offenders: string[] = [];
    for (const [file, src] of ROUTE_SOURCES) {
      if (!/withOperatorGuards\b/.test(src)) continue;
      if (!/rateLimit:\s*"(read|mutate|expensive)"/.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
