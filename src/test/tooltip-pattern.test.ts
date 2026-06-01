import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { walk } from "./utils/walk";

const ROOT = process.cwd();

/**
 * Operator-shell hover tooltips must use the styled `<Tooltip>` component
 * (`src/components/ui/tooltip.tsx`) — the established pattern, used across the
 * access page and other operator surfaces — never the unstyled native `title=`
 * attribute (browser-themed, browser-timed). This guards the regression where
 * the collapsed sidebar fell back to the native browser tooltip on its
 * icon-only items.
 *
 * Allowlist: files that legitimately still contain `title=`. Each entry needs a
 * reason. A NEW native `title=` anywhere in the scanned shell fails CI until it
 * is either converted to `<Tooltip>` or justified here. The placement-limited
 * entries are tracked for a future placement-aware Tooltip (top edge / fixed).
 */
const TITLE_ALLOWLIST: Record<string, string> = {
  "src/components/layout/module-container.tsx":
    "`title` is a PROP forwarded to <PageHeader> (the page title), not a DOM tooltip attribute.",
  "src/components/layout/shell-chrome.tsx":
    "Fixed pull-tab button — the wrapper-anchored Tooltip cannot measure a fixed (out-of-flow) element, so the styled bubble would mis-position. Native title retained.",
};

// `title=` as a JSX attribute (preceded by start-of-line or whitespace, so
// `data-title=` / object keys like `title:` don't match).
const NATIVE_TITLE = /(?:^|\s)title=/;

const SCAN_FILES = [
  ...walk(join(ROOT, "src/components/layout"), [".tsx"]),
  join(ROOT, "src/components/ui/theme-toggle.tsx"),
];

describe("Operator shell tooltip pattern", () => {
  it("uses <Tooltip> for hover tooltips, never the native title= attribute", () => {
    const offenders: string[] = [];
    for (const file of SCAN_FILES) {
      const rel = relative(ROOT, file);
      if (rel in TITLE_ALLOWLIST) continue;
      if (NATIVE_TITLE.test(readFileSync(file, "utf8"))) offenders.push(rel);
    }
    expect(
      offenders,
      `These operator-shell files use the native \`title=\` attribute instead of the styled <Tooltip> ` +
        `(src/components/ui/tooltip.tsx). Wrap the trigger in <Tooltip text="…">{trigger}</Tooltip>, ` +
        `or add the file to TITLE_ALLOWLIST with a reason if it is a legitimate prop / placement-limited case:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("the collapsed sidebar renders its labels via the styled Tooltip", () => {
    const sideNav = readFileSync(
      join(ROOT, "src/components/layout/side-nav.tsx"),
      "utf8",
    );
    expect(sideNav).toMatch(/from "@\/components\/ui\/tooltip"/);
    expect(sideNav).toMatch(/<Tooltip\b/);
    // The reactive collapse hook gates the tooltip to the collapsed icon-only state.
    expect(sideNav).toMatch(/useNavCollapsed/);
    // …and the native attribute must not creep back in.
    expect(NATIVE_TITLE.test(sideNav)).toBe(false);
  });

  it("allowlist entries each carry a justification", () => {
    for (const [file, reason] of Object.entries(TITLE_ALLOWLIST)) {
      expect(reason.length, `${file} needs a non-trivial reason`).toBeGreaterThan(20);
    }
  });
});
