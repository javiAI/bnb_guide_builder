import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Pins the workspace-scoping contract in mutation entry points (Rama 15D).
 *
 * Every operator-facing server action that resolves an entity by id MUST
 * either (a) scope the resolution by the operator's workspaceId in the same
 * query, or (b) cross-check the loaded entity's `property.workspaceId`
 * against `operator.workspaceId` before mutating. A bare `findUnique({where:
 * {id}})` followed by a write would let a tampered id from a different
 * workspace slip through.
 *
 * This test grep-scans the critical files and looks for the two acceptable
 * shapes near each `requireOperator()` block. It's deliberately structural
 * (not a runtime test) because the behaviour we're guarding is "the code
 * remembers to scope" — easy to forget in review, easy to lock in via a scan.
 *
 * Auth delegates: an action may also resolve the operator and scope by
 * workspace via a known helper (`AUTH_DELEGATES`). Each delegate is pinned
 * by an assertion below that checks the helper source itself calls
 * `requireOperator()` and scopes by `operator.workspaceId`.
 */

const ROOT = process.cwd();

const TARGETS: ReadonlyArray<{ path: string; minOccurrences: number }> = [
  { path: "src/lib/actions/guide.actions.ts", minOccurrences: 3 },
  { path: "src/lib/actions/incident.actions.ts", minOccurrences: 5 },
  { path: "src/lib/actions/parking.actions.ts", minOccurrences: 5 },
  { path: "src/lib/actions/arrival.actions.ts", minOccurrences: 6 },
];

/** Helpers known to resolve the operator. Each entry declares whether the
 * helper ALSO scopes the property/entity by `operator.workspaceId`. A call
 * to a `scopesWorkspace: true` delegate substitutes for both a direct
 * `requireOperator()` and a workspace-scope guard at the call site; a
 * `scopesWorkspace: false` delegate only counts for the operator resolution
 * and the caller must add its own scope. Pinned by the assertion below. */
const AUTH_DELEGATES: ReadonlyArray<{
  name: string;
  path: string;
  scopesWorkspace: boolean;
}> = [
  {
    name: "authorizeDiscoveryActor",
    path: "src/lib/services/places/discovery-guards.ts",
    scopesWorkspace: false,
  },
  {
    name: "requireOperatorMutate",
    path: "src/lib/services/places/discovery-guards.ts",
    scopesWorkspace: false,
  },
  {
    name: "bulkConfirmPlaces",
    path: "src/lib/services/places/bulk-confirm-places.ts",
    scopesWorkspace: true,
  },
];

function countMatches(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length;
}

describe("cross-workspace invariants", () => {
  for (const target of TARGETS) {
    it(`${target.path} — every server action requires operator + scopes by workspace`, () => {
      const src = readFileSync(join(ROOT, target.path), "utf-8");

      // Direct requireOperator() calls + each call to a known auth delegate
      // counts as one operator-resolution site.
      const directRequire = countMatches(src, /await\s+requireOperator\(/g);
      let delegateRequire = 0;
      let delegateScopes = 0;
      for (const d of AUTH_DELEGATES) {
        const n = countMatches(src, new RegExp(`\\b${d.name}\\s*\\(`, "g"));
        delegateRequire += n;
        if (d.scopesWorkspace) delegateScopes += n;
      }
      const totalRequire = directRequire + delegateRequire;
      expect(totalRequire).toBeGreaterThanOrEqual(target.minOccurrences);

      // Every action must enforce workspace scoping in at least one of these
      // shapes near the operator resolution. A `scopesWorkspace: true`
      // delegate also counts because the helper applies the scope internally
      // (pinned below).
      const inlineScopes = countMatches(src, /workspaceId:\s*operator\.workspaceId/g);
      const indirectScopes = countMatches(
        src,
        /property:\s*\{\s*workspaceId:\s*operator\.workspaceId\s*\}/g,
      );
      const guardChecks = countMatches(src, /\.workspaceId\s*!==\s*operator\.workspaceId/g);
      const totalScopes =
        inlineScopes + indirectScopes + guardChecks + delegateScopes;

      expect(
        totalScopes,
        `Expected ≥ ${totalRequire} workspace-scope guards in ${target.path}, found ${totalScopes}`,
      ).toBeGreaterThanOrEqual(totalRequire);
    });
  }

  it("every auth delegate calls requireOperator() (and scopes by workspace if claimed)", () => {
    const offenders: string[] = [];
    for (const d of AUTH_DELEGATES) {
      const src = readFileSync(join(ROOT, d.path), "utf-8");
      const callsRequireOperator = /await\s+requireOperator\(/.test(src);
      const callsKnownDelegate = AUTH_DELEGATES.some(
        (other) =>
          other.name !== d.name &&
          new RegExp(`\\b${other.name}\\s*\\(`).test(src),
      );
      if (!callsRequireOperator && !callsKnownDelegate) {
        offenders.push(`${d.path} (delegate missing requireOperator())`);
        continue;
      }
      if (d.scopesWorkspace) {
        const hasInlineScope = /workspaceId:\s*operator\.workspaceId/.test(src);
        const hasGuard = /\.workspaceId\s*!==\s*operator\.workspaceId/.test(src);
        if (!hasInlineScope && !hasGuard) {
          offenders.push(`${d.path} (delegate claims scopesWorkspace but no scope found)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("incident-from-guest.service.ts threads slug for the guest:<slug> actor", () => {
    const src = readFileSync(
      join(ROOT, "src/lib/services/incident-from-guest.service.ts"),
      "utf-8",
    );
    // Slug must be part of the input contract and used in the audit actor.
    expect(src).toMatch(/slug:\s*string/);
    expect(src).toMatch(/formatActor\(\s*\{\s*type:\s*"guest"\s*,\s*slug\s*\}/);
  });

  it("operator-guards.ts does NOT call writeAudit (Fase -1 decision)", () => {
    const src = readFileSync(
      join(ROOT, "src/lib/auth/operator-guards.ts"),
      "utf-8",
    );
    // The wrapper intentionally has no audit logic — writeAudit() lives at
    // mutation call sites. Doc comments are allowed; an actual import or
    // call would be a regression. Strip block comments before scanning.
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\bwriteAudit\s*\(/);
    expect(stripped).not.toMatch(/from\s+["'][^"']*audit\.service["']/);
  });
});
