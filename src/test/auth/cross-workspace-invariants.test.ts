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
 */

const ROOT = process.cwd();

const TARGETS: ReadonlyArray<{ path: string; minOccurrences: number }> = [
  { path: "src/lib/actions/guide.actions.ts", minOccurrences: 3 },
  { path: "src/lib/actions/incident.actions.ts", minOccurrences: 5 },
];

describe("cross-workspace invariants", () => {
  for (const target of TARGETS) {
    it(`${target.path} — every server action requires operator + scopes by workspace`, () => {
      const src = readFileSync(join(ROOT, target.path), "utf-8");

      // requireOperator() must appear at least once per action.
      const requireCalls = src.match(/await\s+requireOperator\(/g) ?? [];
      expect(requireCalls.length).toBeGreaterThanOrEqual(target.minOccurrences);

      // Every action must enforce workspace scoping in at least one of these
      // two shapes near the operator resolution. We require the count of
      // workspaceId checks to be ≥ the count of requireOperator() calls.
      const inlineScopes = src.match(/workspaceId:\s*operator\.workspaceId/g) ?? [];
      const indirectScopes =
        src.match(/property:\s*\{\s*workspaceId:\s*operator\.workspaceId\s*\}/g) ?? [];
      const guardChecks =
        src.match(/\.workspaceId\s*!==\s*operator\.workspaceId/g) ?? [];
      const totalScopes =
        inlineScopes.length + indirectScopes.length + guardChecks.length;

      expect(
        totalScopes,
        `Expected ≥ ${requireCalls.length} workspace-scope guards in ${target.path}, found ${totalScopes}`,
      ).toBeGreaterThanOrEqual(requireCalls.length);
    });
  }

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
