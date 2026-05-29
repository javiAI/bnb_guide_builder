import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Source-level invariants for the parking + arrival discovery actions and
 * the editor access save. These complement `parking-actions-workspace-scope`
 * (which pins ownership) by catching three regression classes:
 *
 *   • `applyOperatorRateLimit({ bucket: "expensive" })` MUST gate every
 *     `reverseGeocodeAddressForPin` call site — without it a burst of
 *     manual pins drains the MapTiler quota cross-actor.
 *   • Atomic JSONB merge (`COALESCE(col, '{}'::jsonb) || $delta::jsonb`)
 *     MUST be used for any write to `arrival_modes_enabled_json` and
 *     `arrival_suggestions_cache_json` and `parking_suggestions_cache_json`.
 *     A read-modify-write under concurrent mode toggles silently loses
 *     deltas.
 *   • Tri-state accessibility save in `editor.actions.ts` MUST consume the
 *     canonical helpers (`normalizeAccessibilityFeatures` +
 *     `deriveAccessibilityPersistence`) rather than re-implementing the
 *     mutex / column-tri-state logic inline.
 */

const PROJECT_ROOT = resolve(__dirname, "..", "..");

function readSrc(relative: string): string {
  return readFileSync(resolve(PROJECT_ROOT, relative), "utf8");
}

describe("expensive bucket gates every reverseGeocodeAddressForPin call", () => {
  // For each file: every occurrence of `reverseGeocodeAddressForPin(` must be
  // preceded (within ~800 chars upward in the same function body) by a call
  // to `applyOperatorRateLimit(` with `bucket: "expensive"`. We use an
  // upstream sliding window rather than a strict immediate predecessor
  // because the gate may be guarded by an `if (gate.ok)` ternary on the
  // same line, or set into a variable for reuse on the relocate branch.
  const FILES = [
    "src/lib/actions/parking.actions.ts",
    "src/lib/actions/arrival.actions.ts",
  ];

  for (const file of FILES) {
    it(`${file} — every reverseGeocodeAddressForPin call is preceded by an "expensive" rate-limit gate`, () => {
      const src = readSrc(file);

      const callRegex = /reverseGeocodeAddressForPin\s*\(/g;
      const offenders: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = callRegex.exec(src)) !== null) {
        const upstreamWindow = src.slice(Math.max(0, m.index - 800), m.index);
        // Match the gate either as a fresh limiter or as a previously-set
        // variable referencing the gate's `.ok`. Both phrasings appear in
        // arrival.actions and parking.actions (see updateArrivalOptionAction
        // for the variable form).
        const hasGate =
          /applyOperatorRateLimit\s*\(\s*\{[^}]*bucket\s*:\s*"expensive"/.test(
            upstreamWindow,
          );
        if (!hasGate) {
          const lineNumber = src.slice(0, m.index).split("\n").length;
          offenders.push(`${file}:${lineNumber}`);
        }
      }

      expect(
        offenders,
        `Found reverseGeocodeAddressForPin call(s) not preceded by an applyOperatorRateLimit({ bucket: "expensive" }) gate within 800 chars: ${offenders.join(", ")}. ` +
          "An unmetered reverse-geocode lets a burst of manual pins drain the MapTiler quota.",
      ).toEqual([]);
    });
  }
});

describe("atomic JSONB merge for property-level cache columns", () => {
  // Every UPDATE statement that touches one of the JSONB cache columns must
  // use the canonical `COALESCE(col, '{}'::jsonb) || $delta::jsonb` shape.
  // Read-modify-write in JS loses concurrent deltas; this invariant prevents
  // a refactor from reintroducing the pattern.
  const CACHE_COLUMNS = [
    "arrival_modes_enabled_json",
    "arrival_suggestions_cache_json",
    "parking_suggestions_cache_json",
  ];

  const FILES = [
    "src/lib/actions/arrival.actions.ts",
    "src/lib/actions/parking.actions.ts",
  ];

  for (const file of FILES) {
    for (const column of CACHE_COLUMNS) {
      it(`${file} — every UPDATE touching ${column} uses COALESCE + JSONB merge`, () => {
        const src = readSrc(file);
        if (!src.includes(`"${column}"`)) {
          // File doesn't touch this column — skip silently.
          return;
        }
        // For each substring that quotes the column inside an UPDATE block,
        // assert the surrounding ~400 chars contain the canonical merge
        // shape. This is a heuristic on the SQL block, not a real parser,
        // but `||` + `COALESCE` + `'{}'::jsonb` is specific enough to be
        // robust against incidental usage of the column name in comments.
        const tokenIdx = src.indexOf(`"${column}"`);
        let offenders = 0;
        let cursor = tokenIdx;
        while (cursor !== -1) {
          const window = src.slice(
            Math.max(0, cursor - 200),
            cursor + 600,
          );
          // Allow comment-only references (e.g. JSDoc citing the column) —
          // those have no surrounding `SET` or `UPDATE` keyword in window.
          const looksLikeSqlBlock =
            /\bSET\b/.test(window) || /\bUPDATE\b/.test(window);
          if (looksLikeSqlBlock) {
            const hasCoalesce = /COALESCE\s*\(\s*"[^"]+"\s*,\s*'\{\}'::jsonb\s*\)/.test(window);
            const hasJsonbMerge = /\|\|\s*\$\{[a-zA-Z_]+\}::jsonb/.test(window);
            if (!(hasCoalesce && hasJsonbMerge)) {
              offenders += 1;
            }
          }
          cursor = src.indexOf(`"${column}"`, cursor + 1);
        }
        expect(
          offenders,
          `Found ${offenders} SQL UPDATE block(s) on ${column} in ${file} that don't use COALESCE + JSONB merge. ` +
            "A read-modify-write under concurrent toggles will silently drop deltas.",
        ).toBe(0);
      });
    }
  }
});

describe("tri-state accessibility save path consumes the canonical helper", () => {
  const FILE = "src/lib/actions/editor.actions.ts";

  it("editor.actions.ts imports the access-tri-state helpers", () => {
    const src = readSrc(FILE);
    expect(src).toContain(
      'from "@/lib/services/access-tri-state"',
    );
    expect(src).toContain("normalizeAccessibilityFeatures");
    expect(src).toContain("deriveAccessibilityPersistence");
  });

  it("editor.actions.ts no longer carries an inline IIFE filtering ax.no_accessibility", () => {
    // The inline IIFE pattern (`(() => { ... 'ax.no_accessibility' ... })()`)
    // is what the helper replaces. Keeping a literal `"ax.no_accessibility"`
    // string in a function body of this file means the mutex logic has been
    // duplicated — the canonical home is `access-tri-state.ts`.
    const src = readSrc(FILE);
    expect(
      src.includes('"ax.no_accessibility"'),
      "editor.actions.ts should not reference the sentinel directly — it lives in @/lib/services/access-tri-state and the helpers handle the tri-state for callers.",
    ).toBe(false);
  });

  it("the helper module exports the sentinel id constants once", () => {
    const src = readSrc("src/lib/services/access-tri-state.ts");
    expect(src).toContain('NO_ACCESSIBILITY_ID = "ax.no_accessibility"');
    expect(src).toContain('OTHER_ACCESSIBILITY_ID = "ax.other"');
  });
});

describe("arrival reverse-geocode uses bare reverse (no preferCategoryKey)", () => {
  // The synthetic `lp.arrival_*` namespace is internal-only — MapTiler reverse
  // classifies every transit POI as the generic `lp.transport`. With the
  // strict reverse contract (PR #106), passing `preferCategoryKey:
  // "lp.arrival_<mode>"` would always return null, breaking manual pin
  // address-fill + arrival relocate. Both arrival call sites must therefore
  // omit `preferCategoryKey` — the operator already declared the mode by
  // choosing the tab; the geocoded address is for display only.
  //
  // Parking IS allowed to use `preferCategoryKey: "lp.parking"` because
  // MapTiler returns `lp.parking` directly for parking POIs.
  it("arrival.actions.ts never passes preferCategoryKey to reverseGeocodeAddressForPin", () => {
    const src = readSrc("src/lib/actions/arrival.actions.ts");
    const callRegex = /reverseGeocodeAddressForPin\s*\(\s*\{([^}]*)\}/g;
    const offenders: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = callRegex.exec(src)) !== null) {
      const argsBlock = m[1] ?? "";
      if (/preferCategoryKey/.test(argsBlock)) {
        const lineNumber = src.slice(0, m.index).split("\n").length;
        offenders.push(`arrival.actions.ts:${lineNumber}`);
      }
    }
    expect(
      offenders,
      `Found reverseGeocodeAddressForPin call(s) in arrival.actions.ts with preferCategoryKey set: ${offenders.join(", ")}. ` +
        "MapTiler reverse never classifies transit POIs as lp.arrival_<mode> (synthetic namespace) — the strict category contract returns null, breaking address autofill. " +
        "Use bare reverse; the operator-declared mode is the source of truth.",
    ).toEqual([]);
  });
});

describe("rate-tier schema is the single source of truth", () => {
  // The arrival-steps-helpers UI file re-exports from the canonical Zod
  // schema rather than defining its own RateTier / RateTierPer. Pinning
  // this prevents a future drift between client UI (chip group) and
  // server validation (zod parse in parking/arrival actions).
  it("arrival-steps-helpers re-exports from @/lib/schemas/rate-tier.schema", () => {
    const src = readSrc(
      "src/app/properties/[propertyId]/access/_components/arrival-steps-helpers.ts",
    );
    expect(src).toMatch(
      /from\s+"@\/lib\/schemas\/rate-tier\.schema"/,
    );
    // Reject a local re-declaration of the union — even one variant slipping
    // out of sync would cause silent UI/server mismatches.
    expect(src).not.toMatch(/export type RateTierPer\s*=\s*"minute"/);
  });
});
