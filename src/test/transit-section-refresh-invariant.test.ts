import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Source-level invariant: TransitSection's confirm/delete/rename handlers
 * must call `router.refresh()` on success and `setError()` on failure.
 *
 * Without `router.refresh()`, the parent server-component tree doesn't
 * re-fetch and the cockpit shows stale parking/transit pin lists after a
 * mutation (the bug fixed by PR #106's stale-state correction).
 *
 * Without `setError()`, action failures fail silently in the UI.
 *
 * Each handler also must clear stale errors with `setError(null)` on entry.
 */

const FILE = resolve(
  __dirname,
  "..",
  "app",
  "properties",
  "[propertyId]",
  "access",
  "_components",
  "transit-section.tsx",
);

const src = readFileSync(FILE, "utf8");

interface HandlerCheck {
  name: string;
  /** Marker that begins the handler body — the regex below scans from here. */
  startMarker: string;
  /** Approximate body length to scan (chars). Handlers are <70 lines. */
  windowSize: number;
}

const HANDLERS: ReadonlyArray<HandlerCheck> = [
  {
    name: "handleConfirmOne",
    startMarker: "handleConfirmOne = useCallback(",
    windowSize: 1800,
  },
  {
    name: "handleDelete",
    startMarker: "handleDelete = useCallback(",
    windowSize: 800,
  },
  {
    name: "handleRenameOption",
    startMarker: "handleRenameOption = useCallback(",
    windowSize: 800,
  },
];

describe("TransitSection handlers refresh server state and surface errors", () => {
  it("imports useRouter from next/navigation", () => {
    expect(src).toMatch(/import\s+\{\s*useRouter\s*\}\s+from\s+["']next\/navigation["']/);
  });

  it("instantiates the router via useRouter()", () => {
    expect(src).toMatch(/const\s+router\s*=\s*useRouter\(\)/);
  });

  for (const h of HANDLERS) {
    it(`${h.name} clears error, calls router.refresh on success, and setError on failure`, () => {
      const idx = src.indexOf(h.startMarker);
      expect(idx, `Handler ${h.name} not found in transit-section.tsx`).toBeGreaterThan(-1);

      const body = src.slice(idx, idx + h.windowSize);

      expect(
        body,
        `${h.name} must call setError(null) at entry to clear stale errors`,
      ).toContain("setError(null)");

      expect(
        body,
        `${h.name} must call router.refresh() on success — otherwise the cockpit shows stale server state`,
      ).toContain("router.refresh()");

      expect(
        body,
        `${h.name} must call setError(...) on action failure — silent failures regress UX`,
      ).toMatch(/setError\(res\.error\b/);
    });
  }
});
