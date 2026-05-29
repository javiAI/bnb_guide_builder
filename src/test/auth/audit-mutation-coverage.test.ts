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
 *
 * Audited delegates: a small whitelist of helper names (`AUDITED_DELEGATES`)
 * is treated as equivalent to a direct `writeAudit()` call. Each entry is a
 * helper that itself emits `writeAudit()` internally — pinned by a second
 * assertion below. Adding to the whitelist requires the same proof.
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
    path: "src/lib/actions/parking.actions.ts",
    required: [
      "confirmParkingPlacesBulkAction",
      "addManualParkingPlaceAction",
      "updateParkingPlaceAction",
      "deleteParkingPlaceAction",
    ],
  },
  {
    path: "src/lib/actions/arrival.actions.ts",
    required: [
      "confirmArrivalOptionsBulkAction",
      "addManualArrivalOptionAction",
      "updateArrivalOptionAction",
      "deleteArrivalOptionAction",
      "setArrivalModeEnabledAction",
      "setArrivalOptionRateAction",
    ],
  },
  {
    path: "src/lib/services/incident-from-guest.service.ts",
    required: ["createIncidentFromGuest"],
  },
  {
    path: "src/lib/imports/shared/import-applier.service.ts",
    required: ["applyImportDiff"],
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

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Extract the body of an async function/action by name (best-effort). */
function extractFunctionBody(src: string, name: string): string | null {
  const re = new RegExp(`\\b(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*[^{]*\\{`, "m");
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length - 1; // pointer to `{`
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

/** Helpers known to emit `writeAudit()` internally. A function in `TARGETS`
 * may delegate to one of these in place of a literal `writeAudit()` call,
 * because the audit still happens on the same logical path — the test below
 * pins each delegate by checking the helper source contains `writeAudit(`
 * + the required audit-service imports. */
const AUDITED_DELEGATES: ReadonlyArray<{ name: string; path: string }> = [
  {
    name: "bulkConfirmPlaces",
    path: "src/lib/services/places/bulk-confirm-places.ts",
  },
];

function bodyHasAudit(body: string): boolean {
  const stripped = stripComments(body);
  if (/writeAudit\s*\(/.test(stripped)) return true;
  for (const d of AUDITED_DELEGATES) {
    if (new RegExp(`\\b${d.name}\\s*\\(`).test(stripped)) return true;
  }
  return false;
}

describe("audit mutation coverage invariants", () => {
  for (const target of TARGETS) {
    it(`${target.path} — every required function calls writeAudit() (directly or via an audited delegate)`, () => {
      const full = join(ROOT, target.path);
      const src = readFileSync(full, "utf-8");
      // Either the file directly imports writeAudit OR it imports a known
      // audited delegate — same contract, different surface.
      const referencesAuditPath =
        /writeAudit\b/.test(src) ||
        AUDITED_DELEGATES.some((d) =>
          new RegExp(`\\b${d.name}\\b`).test(src),
        );
      expect(referencesAuditPath).toBe(true);

      const offenders: string[] = [];
      for (const name of target.required) {
        const body = extractFunctionBody(src, name);
        if (!body) {
          offenders.push(`${name} (function not found in ${target.path})`);
          continue;
        }
        if (!bodyHasAudit(body)) {
          offenders.push(
            `${name} (no writeAudit() call and no audited delegate)`,
          );
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  it("all targets reference the audit path (writeAudit directly or an audited delegate)", () => {
    const offenders: string[] = [];
    for (const target of TARGETS) {
      const full = join(ROOT, target.path);
      const src = readFileSync(full, "utf-8");
      const directImports =
        /writeAudit/.test(src) && /formatActor/.test(src) && /AUDIT_ACTIONS/.test(src);
      const delegateImport = AUDITED_DELEGATES.some((d) =>
        new RegExp(`\\b${d.name}\\b`).test(src),
      );
      if (!directImports && !delegateImport) offenders.push(target.path);
    }
    expect(offenders).toEqual([]);
  });

  it("every audited delegate emits writeAudit() + imports formatActor + AUDIT_ACTIONS", () => {
    const offenders: string[] = [];
    for (const d of AUDITED_DELEGATES) {
      const full = join(ROOT, d.path);
      const src = readFileSync(full, "utf-8");
      if (!/writeAudit\s*\(/.test(stripComments(src))) {
        offenders.push(`${d.path} (delegate missing writeAudit() call)`);
        continue;
      }
      if (
        !/writeAudit/.test(src) ||
        !/formatActor/.test(src) ||
        !/AUDIT_ACTIONS/.test(src)
      ) {
        offenders.push(`${d.path} (delegate missing audit-service imports)`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
