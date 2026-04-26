import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Pins the wiring contract for critical mutation surfaces (Rama 15D).
 *
 * The list of files below is deliberately curated: it covers the entry points
 * that mutate AuditLog-relevant entities (GuideVersion publish/unpublish/
 * rollback, Incident lifecycle, guest incident creation, session start/end).
 * Adding a new file to this list requires also adding the writeAudit() call —
 * that's the point. A blanket AST scan over every prisma.*.create / update /
 * delete in the codebase produces too many false positives (cross-row
 * housekeeping, internal denormalizations) to be useful as a gate.
 */

const ROOT = process.cwd();

interface Target {
  path: string;
  /** Function names within the file that must call writeAudit. */
  required: string[];
}

const TARGETS: Target[] = [
  {
    path: "src/lib/actions/guide.actions.ts",
    required: [
      "publishGuideVersionAction",
      "unpublishVersionAction",
      "rollbackToVersionAction",
    ],
  },
  {
    path: "src/lib/actions/incident.actions.ts",
    required: [
      "createIncidentAction",
      "updateIncidentAction",
      "deleteIncidentAction",
      "changeIncidentStatusAction",
      "resolveIncidentAction",
    ],
  },
  {
    path: "src/lib/services/incident-from-guest.service.ts",
    required: ["createIncidentFromGuest"],
  },
  {
    path: "src/app/api/auth/google/callback/route.ts",
    required: ["GET"],
  },
  {
    path: "src/app/api/auth/logout/route.ts",
    required: ["POST"],
  },
];

/** Extract the body of an async function/action by name (best-effort). */
function extractFunctionBody(src: string, name: string): string | null {
  const re = new RegExp(`\\b(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*[^{]*\\{`, "m");
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length - 1; // pointer to `{`
  // brace-balance scan
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

describe("audit mutation coverage invariants", () => {
  for (const target of TARGETS) {
    it(`${target.path} — every required function calls writeAudit()`, () => {
      const full = join(ROOT, target.path);
      const src = readFileSync(full, "utf-8");
      expect(src).toMatch(/writeAudit\b/);

      const offenders: string[] = [];
      for (const name of target.required) {
        const body = extractFunctionBody(src, name);
        if (!body) {
          offenders.push(`${name} (function not found in ${target.path})`);
          continue;
        }
        if (!/writeAudit\s*\(/.test(body)) {
          offenders.push(`${name} (no writeAudit() call)`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  it("all targets import writeAudit + formatActor + AUDIT_ACTIONS", () => {
    const offenders: string[] = [];
    for (const target of TARGETS) {
      const full = join(ROOT, target.path);
      const src = readFileSync(full, "utf-8");
      const importsAll =
        /writeAudit/.test(src) && /formatActor/.test(src) && /AUDIT_ACTIONS/.test(src);
      if (!importsAll) offenders.push(target.path);
    }
    expect(offenders).toEqual([]);
  });
});
