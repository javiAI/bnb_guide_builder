import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Invariant test: the guide rendering service must not contain hardcoded
// taxonomy ID comparisons. Adding a new amenity, system, policy or access
// method should never require editing the service.
//
// Banned patterns:
//   === "am.xxx"  / !== "am.xxx"   (amenity IDs)
//   === "sp.xxx"  / !== "sp.xxx"   (space-type IDs)
//   === "sys.xxx" / !== "sys.xxx"  (system IDs)
//   === "pol.xxx" / !== "pol.xxx"  (policy IDs)
//   === "ax.xxx"  / !== "ax.xxx"   (access method IDs)
//
// Taxonomy JSON files and tests are exempt (tests use IDs as inputs).

const SERVICE_PATH = join(
  process.cwd(),
  "src/lib/services/guide-rendering.service.ts",
);

const BANNED_PREFIXES = ["am", "sp", "sys", "pol", "ax"];

describe("guide-rendering.service — zero hardcoded IDs", () => {
  it("has no === or !== comparisons against prefixed taxonomy IDs", () => {
    const source = readFileSync(SERVICE_PATH, "utf8");
    const offenders: string[] = [];
    for (const prefix of BANNED_PREFIXES) {
      const regex = new RegExp(
        `[!=]==\\s*["\`']${prefix}\\.[a-z_][a-z0-9_]*["\`']`,
        "gi",
      );
      const matches = source.match(regex);
      if (matches) offenders.push(...matches);
    }
    expect(
      offenders,
      `Hardcoded taxonomy IDs found in guide-rendering.service.ts: ${offenders.join(", ")}. ` +
        "Iterate entities + enrich from taxonomy instead.",
    ).toEqual([]);
  });

  it("does not include lowercase taxonomy IDs in switch case branches", () => {
    const source = readFileSync(SERVICE_PATH, "utf8");
    // Rough secondary check: "case \"am.\"", "case \"sp.\"" etc.
    const caseRegex = /case\s+["`']([a-z]+)\.[a-z_][a-z0-9_]*["`']/g;
    const hits: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = caseRegex.exec(source)) !== null) {
      if (BANNED_PREFIXES.includes(m[1])) hits.push(m[0]);
    }
    expect(hits).toEqual([]);
  });
});
