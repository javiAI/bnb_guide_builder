import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Source-level invariant: every `prisma.localPlace.find{Many,First,Unique}`
 * read inside parking.actions.ts and arrival.actions.ts must scope by the
 * operator's workspace via `property: { workspaceId: operator.workspaceId }`.
 *
 * The cross-check pattern of `findUnique(placeId)` + later comparison to
 * `formData.propertyId` is NOT sufficient — `propertyId` is client-supplied
 * and tampering must be rejected at the query boundary, not after the read.
 *
 * Add a new LocalPlace read to either file = extend SCOPE_CALL_SITES below
 * and ensure the WHERE clause carries the workspace constraint.
 */

const PROJECT_ROOT = resolve(__dirname, "..", "..");

const SCOPE_CALL_SITES: ReadonlyArray<{
  file: string;
  description: string;
  /** The substring that must appear within the read's WHERE clause. We rely on
   * the canonical phrase `property: { workspaceId: operator.workspaceId }` —
   * any variant (e.g. `property: { workspaceId: op.workspaceId }`) requires
   * updating this allow-list together with `audit-mutation-coverage.test.ts`. */
  scopeClause: string;
  /** Minimum number of occurrences expected — bump when adding new sites. */
  minOccurrences: number;
}> = [
  {
    file: "src/lib/actions/parking.actions.ts",
    description: "parking actions read LocalPlace rows scoped to operator workspace",
    scopeClause: "property: { workspaceId: operator.workspaceId }",
    // refreshParkingSuggestionsAction + updateParkingPlaceAction findFirst +
    // deleteParkingPlaceAction findFirst = 3 sites
    minOccurrences: 3,
  },
  {
    file: "src/lib/actions/arrival.actions.ts",
    description: "arrival actions read LocalPlace rows scoped to operator workspace",
    scopeClause: "property: { workspaceId: operator.workspaceId }",
    // refreshArrivalSuggestionsAction + updateArrivalPlaceAction findFirst +
    // deleteArrivalPlaceAction findFirst + setArrivalRateAction findFirst = 4 sites
    minOccurrences: 4,
  },
];

describe("LocalPlace reads in discovery actions are workspace-scoped", () => {
  for (const site of SCOPE_CALL_SITES) {
    it(`${site.file} — ${site.description}`, () => {
      const filePath = resolve(PROJECT_ROOT, site.file);
      const src = readFileSync(filePath, "utf8");
      const occurrences = src.split(site.scopeClause).length - 1;
      expect(
        occurrences,
        `Expected at least ${site.minOccurrences} occurrences of "${site.scopeClause}" in ${site.file}, found ${occurrences}. ` +
          "A LocalPlace read without workspace scope is a cross-workspace tampering vector — add the scope clause to the WHERE.",
      ).toBeGreaterThanOrEqual(site.minOccurrences);
    });

    it(`${site.file} — every prisma.localPlace.find* read is followed by a workspace scope clause within its WHERE`, () => {
      const filePath = resolve(PROJECT_ROOT, site.file);
      const src = readFileSync(filePath, "utf8");

      // For each `prisma.localPlace.find{First,Unique,Many}(` occurrence, scan
      // the next ~600 chars (the WHERE block) for the scope clause. Skip
      // occurrences that are inside strings/comments — none of these files
      // mention `prisma.localPlace.find*` in either, so a plain substring
      // walker is sufficient.
      const findRegex = /prisma\.localPlace\.find(?:First|Unique|Many)\s*\(/g;
      const matches: number[] = [];
      let m: RegExpExecArray | null;
      while ((m = findRegex.exec(src)) !== null) {
        matches.push(m.index);
      }

      const offenders: string[] = [];
      for (const idx of matches) {
        const window = src.slice(idx, idx + 600);
        if (!window.includes(site.scopeClause)) {
          const lineNumber = src.slice(0, idx).split("\n").length;
          offenders.push(`${site.file}:${lineNumber}`);
        }
      }

      expect(
        offenders,
        `Found prisma.localPlace.find* read(s) without the workspace scope clause ` +
          `"${site.scopeClause}" within the WHERE: ${offenders.join(", ")}. ` +
          "Add the scope or move the read behind authorizeDiscoveryActor + " +
          "include the property.workspaceId constraint.",
      ).toEqual([]);
    });
  }
});
