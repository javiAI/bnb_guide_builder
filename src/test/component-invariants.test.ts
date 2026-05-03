import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  AUDITED_SURFACES,
  TOUCH_TARGET_EXCEPTIONS,
  WEB_API_GUARD_EXCEPTIONS,
  COPY_LINT_EXCEPTIONS,
  EMPTY_HANDLER_PLACEHOLDERS,
  EFFECT_CLEANUP_EXCEPTIONS,
  PRIMITIVE_ADOPTION_EXCEPTIONS,
  type ExceptionEntry,
  type RemoveBy,
} from "./parity-allowlist";

/**
 * Component invariants for the Liora replatform — complementary to
 * parity-static.test.ts. parity-static covers global hex/token/suffix gates
 * + button-styled Link a:hover overrides. This file covers structural
 * invariants on audited surfaces (touch targets, HTML validity, web-API
 * guards, copy lint, tone shape, empty handlers, effect cleanup, primitive
 * adoption) plus exception-list shape.
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function globToRegExp(pattern: string): RegExp {
  const parts = pattern.split(/(\*\*\/|\*\*|\*)/g);
  const body = parts
    .map((p) => {
      if (p === "**/" || p === "**") return "(?:[^/]+/)*";
      if (p === "*") return "[^/]*";
      return p.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp("^" + body + "$");
}

function matchesAny(file: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => globToRegExp(p).test(file));
}

const ALL_FILES = walk(join(ROOT, "src"))
  .map((f) => relative(ROOT, f).split(sep).join("/"))
  .filter((f) => /\.(tsx?|jsx?)$/.test(f))
  .filter((f) => !/\.(test|spec|stories)\.[tj]sx?$/.test(f));

const AUDITED_PATTERNS = AUDITED_SURFACES.flatMap((s) => s.files);
const auditedFiles = ALL_FILES.filter((f) => matchesAny(f, AUDITED_PATTERNS));

const fileCache = new Map<string, string>();
function readSrc(file: string): string {
  let cached = fileCache.get(file);
  if (cached === undefined) {
    cached = readFileSync(join(ROOT, file), "utf8");
    fileCache.set(file, cached);
  }
  return cached;
}

function exempt(file: string, list: ReadonlyArray<ExceptionEntry>): boolean {
  return list.some((e) => e.file === file);
}

function lineNumber(content: string, idx: number): number {
  return content.slice(0, idx).split("\n").length;
}

/**
 * JSX opening-tag walker that respects `{}` brace nesting and string
 * literals. A regex stop at the first `>` is wrong because JSX expressions
 * commonly contain `=>` inside attribute callbacks (e.g. `onClick={() =>
 * setOpen(false)}`), which would truncate the attribute soup mid-stream.
 */
interface OpenTag {
  name: string;
  attrs: string;
  openIdx: number;
}

function* iterateOpenTags(
  content: string,
  names: ReadonlyArray<string>,
): Generator<OpenTag> {
  let i = 0;
  while (i < content.length) {
    const lt = content.indexOf("<", i);
    if (lt < 0) return;
    const matchedName = names.find((n) => {
      const start = lt + 1;
      if (content.slice(start, start + n.length) !== n) return false;
      const after = content[start + n.length];
      return after === " " || after === "\t" || after === "\n" || after === "/" || after === ">";
    });
    if (!matchedName) {
      i = lt + 1;
      continue;
    }
    const attrStart = lt + 1 + matchedName.length;
    let j = attrStart;
    let depth = 0;
    let str: '"' | "'" | "`" | null = null;
    while (j < content.length) {
      const c = content[j];
      if (str) {
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === str) str = null;
        j++;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        str = c;
        j++;
        continue;
      }
      if (c === "{") {
        depth++;
        j++;
        continue;
      }
      if (c === "}") {
        depth--;
        j++;
        continue;
      }
      if (depth === 0 && c === ">") {
        break;
      }
      j++;
    }
    if (j >= content.length) return;
    yield {
      name: matchedName,
      attrs: content.slice(attrStart, j),
      openIdx: lt,
    };
    i = j + 1;
  }
}

const VALID_REMOVE_BY: ReadonlySet<RemoveBy> = new Set([
  "16D.5",
  "16E",
  "16F",
  "16G",
  "never",
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Touch-target invariant (≥44 hit area)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · touch targets (≥44 hit area)", () => {
  it("every button-shaped clickable on audited surfaces reaches 44 (visual or via slop)", () => {
    // Scope: only "button-shaped" elements — those with a custom surface
    // (bg-[var(--color-...]) or a custom outline (border border-[var(--color-...]).
    // Inline text links (text-[var(--color-text-link)] hover:underline, no bg/border)
    // are excluded per WCAG 2.5.8 "inline targets" exemption — those are
    // covered by reading-flow constraints, not target size.
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      if (exempt(file, TOUCH_TARGET_EXCEPTIONS)) continue;
      const content = readSrc(file);
      for (const tag of iterateOpenTags(content, ["button", "Link", "a"])) {
        const { name, attrs, openIdx } = tag;
        if (/\baria-hidden=("true"|\{true\})/.test(attrs)) continue;
        const clsMatch = attrs.match(
          /\bclassName=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/,
        );
        if (!clsMatch) continue;
        const cls = clsMatch[1] ?? clsMatch[2] ?? clsMatch[3] ?? "";
        // Button-shape gate: a non-hover surface, OR a true rounded outlined
        // shape (`border` token followed by whitespace + a token-bound
        // border color + a rounded-[...] radius). Divider-only patterns like
        // `border-b border-[var(--color-border-subtle)]` are excluded — they
        // are layout dividers, not button outlines.
        const hasSurface = /(?<!hover:)bg-\[var\(--color-/.test(cls);
        const hasButtonOutline =
          /\bborder(?=\s)/.test(cls) &&
          /(?<!hover:)border-\[var\(--color-/.test(cls) &&
          /\brounded-\[/.test(cls);
        if (!hasSurface && !hasButtonOutline) continue;
        const tokens = [
          "min-h-[44px]",
          "min-h-11",
          "min-h-12",
          "h-11",
          "h-12",
          "h-14",
          "h-16",
          "recipe-icon-btn-32",
        ];
        const reaches44 = tokens.some((t) => cls.includes(t));
        if (!reaches44) {
          violations.push(
            `${file}:${lineNumber(content, openIdx)}  <${name}> button-shaped but missing min-h-[44px] / h-11 / recipe-icon-btn-32`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. HTML validity (no nested <button> / <a> in audited tsx)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · HTML validity", () => {
  it("no nested <button> inside <button> on audited surfaces", () => {
    // Heuristic: literal <button ...>...</button> regions must not contain
    // another <button. Resolved-component buttons (e.g. <IconButton>) cannot
    // be detected statically — those are caught by review + the touch-target
    // / a11y testing harness, not this invariant.
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readSrc(file);
      for (const tag of iterateOpenTags(content, ["button"])) {
        const attrEnd = tag.openIdx + 1 + tag.name.length + tag.attrs.length + 1;
        const closingIdx = content.indexOf("</button>", attrEnd);
        if (closingIdx < 0) continue;
        const inner = content.slice(attrEnd, closingIdx);
        if (/<button\b/.test(inner)) {
          violations.push(
            `${file}:${lineNumber(content, tag.openIdx)}  <button> contains nested <button>`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("no nested <a>/<Link> inside <a>/<Link> on audited surfaces", () => {
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readSrc(file);
      for (const tag of iterateOpenTags(content, ["a", "Link"])) {
        const attrEnd = tag.openIdx + 1 + tag.name.length + tag.attrs.length + 1;
        const closer = `</${tag.name}>`;
        const closingIdx = content.indexOf(closer, attrEnd);
        if (closingIdx < 0) continue;
        const inner = content.slice(attrEnd, closingIdx);
        if (/<a\b|<Link\b/.test(inner)) {
          violations.push(
            `${file}:${lineNumber(content, tag.openIdx)}  <${tag.name}> contains nested anchor/Link`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Web API guards (SSR-safe access)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · web API guards", () => {
  it("audited surfaces guard window/localStorage/matchMedia access", () => {
    const apiRe =
      /\b(localStorage|sessionStorage|navigator|window\.matchMedia|window\.addEventListener)\b/;
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!/\.(tsx?|jsx?)$/.test(file)) continue;
      if (exempt(file, WEB_API_GUARD_EXCEPTIONS)) continue;
      const content = readSrc(file);
      if (!apiRe.test(content)) continue;
      const guarded =
        /typeof\s+window\s*!==\s*"undefined"/.test(content) ||
        /typeof\s+localStorage\s*!==\s*"undefined"/.test(content) ||
        /\buseEffect\s*\(/.test(content) ||
        /\buseLayoutEffect\s*\(/.test(content);
      if (!guarded) {
        violations.push(
          `${file}  uses window/localStorage/matchMedia without typeof guard or useEffect/useLayoutEffect`,
        );
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Copy lint (operator surfaces are Spanish; flag English placeholders)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · copy lint (Spanish on operator surfaces)", () => {
  it("no English placeholder strings in audited operator copy", () => {
    // Conservative blocklist — adding a phrase here is a CR signal, not a
    // lint catch-all. We do a literal substring match over the file (no
    // JSX/comment/attr filtering); the blocklist is intentionally narrow
    // enough that false positives haven't surfaced. If a phrase grows
    // ambiguous (e.g. legitimately appearing inside a comment), the right
    // response is to remove it from the blocklist or replace the substring
    // match with an AST-aware walk — not to expand the impl silently.
    const blocklist = [
      "Coming soon",
      "Click here",
      "Lorem ipsum",
      "Placeholder text",
    ];
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      if (exempt(file, COPY_LINT_EXCEPTIONS)) continue;
      const content = readSrc(file);
      for (const phrase of blocklist) {
        const idx = content.indexOf(phrase);
        if (idx >= 0) {
          violations.push(`${file}:${lineNumber(content, idx)}  "${phrase}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Tailwind hardcode extension (no named-palette utility classes)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · Tailwind hardcode extension", () => {
  it("no Tailwind named-palette classes (use semantic tokens)", () => {
    const re =
      /\b(text|bg|border|ring|fill|stroke|from|to|via|placeholder)-(gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|zinc|neutral|stone)-\d{2,3}\b/g;
    const violations: string[] = [];
    for (const file of auditedFiles) {
      const content = readSrc(file);
      for (const m of content.matchAll(re)) {
        violations.push(`${file}:${lineNumber(content, m.index ?? 0)}  ${m[0]}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Tone quartet (Record<BadgeTone, …> must have exactly 4 keys)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · tone quartet", () => {
  it("Record<BadgeTone, ...> literals contain exactly {neutral,success,warning,danger}", () => {
    // Scoped to `Record<BadgeTone, string>` — flat-string values only. A
    // future `Record<BadgeTone, {bg:string;text:string}>` would slip the gate
    // until we extend the matcher; document here so the limitation is visible
    // when someone adds an object-valued tone record.
    const reBlock = /:\s*Record<BadgeTone,\s*string>\s*=\s*\{([\s\S]*?)\};?/g;
    const keyRe = /^\s*(\w+)\s*:/gm;
    const expectedKeys = new Set(["neutral", "success", "warning", "danger"]);
    const violations: string[] = [];
    for (const file of ALL_FILES) {
      if (!/\.(tsx?|jsx?)$/.test(file)) continue;
      const content = readSrc(file);
      for (const m of content.matchAll(reBlock)) {
        const body = m[1];
        const keys = new Set<string>();
        for (const km of body.matchAll(keyRe)) keys.add(km[1]);
        const missing = [...expectedKeys].filter((k) => !keys.has(k));
        const extra = [...keys].filter((k) => !expectedKeys.has(k));
        if (missing.length || extra.length) {
          violations.push(
            `${file}:${lineNumber(content, m.index ?? 0)}  Record<BadgeTone> ${missing.length ? `missing [${missing.join(", ")}]` : ""}${extra.length ? ` extra [${extra.join(", ")}]` : ""}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Empty handler (onClick={() => {}} signals dead UI)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · empty handlers", () => {
  it("no on{Click,Submit,Change,KeyDown,KeyUp,Input}={() => {}} on audited surfaces", () => {
    const re =
      /\bon(Click|Submit|Change|KeyDown|KeyUp|Input)=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/g;
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      if (exempt(file, EMPTY_HANDLER_PLACEHOLDERS)) continue;
      const content = readSrc(file);
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        violations.push(
          `${file}:${lineNumber(content, m.index)}  ${m[0]}`,
        );
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Effect cleanup (useEffect with timers/listeners must return cleanup)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · effect cleanup", () => {
  it("useEffect/useLayoutEffect bodies with side-effects declare a cleanup return", () => {
    // Per-file heuristic: if a file uses useEffect/useLayoutEffect AND any of
    // setTimeout/setInterval/addEventListener/requestAnimationFrame, then it
    // must contain at least one `return () =>` (the cleanup arrow). Allows
    // false negatives on multi-effect files where one effect cleans up and
    // another doesn't — those are caught at code review, not by this gate.
    const sideEffectRe =
      /\b(setTimeout|setInterval|addEventListener|requestAnimationFrame)\s*\(/;
    const effectRe = /\b(useEffect|useLayoutEffect)\s*\(/;
    const cleanupRe = /\breturn\s*\(?\s*\(\s*\)\s*=>/;
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!/\.(tsx?|jsx?)$/.test(file)) continue;
      if (exempt(file, EFFECT_CLEANUP_EXCEPTIONS)) continue;
      const content = readSrc(file);
      if (!effectRe.test(content)) continue;
      if (!sideEffectRe.test(content)) continue;
      if (!cleanupRe.test(content)) {
        violations.push(
          `${file}  useEffect with timer/listener side-effect lacks "return () =>" cleanup`,
        );
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Command-bar slot is non-interactive (placeholder until 16E)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · command-bar slot non-interactive", () => {
  it("command-bar-slot.tsx is aria-hidden + has no interactive handlers", () => {
    const file = "src/components/layout/command-bar-slot.tsx";
    const content = readSrc(file);
    expect(content).toMatch(/aria-hidden=("true"|\{true\})/);
    expect(content).not.toMatch(/\bon(Click|Change|Input|KeyDown|KeyUp|Submit)=/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Primitive adoption (overview shell → <Card variant="overview">)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · primitive adoption", () => {
  it("overview cards with the canonical shell use <Card variant='overview'>", () => {
    // Detect the canonical shell signature on a raw <div> root: must contain
    // ALL of `flex`, `h-full`, `flex-col`, `rounded-[var(--radius-lg)]`,
    // `border-[var(--color-border-default)]`, `bg-[var(--color-background-elevated)]`,
    // `p-4` in a single className. Files matching must use the primitive
    // unless explicitly exempted (commit-3 migration list).
    const required = [
      "flex",
      "h-full",
      "flex-col",
      "rounded-[var(--radius-lg)]",
      "border-[var(--color-border-default)]",
      "bg-[var(--color-background-elevated)]",
      "p-4",
    ];
    const overviewFiles = ALL_FILES.filter((f) =>
      /^src\/components\/overview\/.+\.tsx$/.test(f),
    );
    const violations: string[] = [];
    const divRe =
      /<div\b[^>]*\bclassName=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g;
    for (const file of overviewFiles) {
      if (exempt(file, PRIMITIVE_ADOPTION_EXCEPTIONS)) continue;
      const content = readSrc(file);
      let m: RegExpExecArray | null;
      while ((m = divRe.exec(content)) !== null) {
        const cls = m[1] ?? m[2] ?? m[3] ?? "";
        if (required.every((token) => cls.includes(token))) {
          violations.push(
            `${file}:${lineNumber(content, m.index)}  raw <div> with overview shell — use <Card variant="overview">`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Interactive elements must be <button>/<Link>, not <div onClick>/<span onClick>
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · interactive elements use button/Link", () => {
  it("no <div>/<span> with onClick/onKeyDown handlers on audited surfaces", () => {
    // Backdrop scrims and other aria-hidden decorations are exempt — they are
    // not in the focus order or the AT tree, so the "use a button" rule does
    // not apply (they exist purely to capture mouse-only dismiss gestures).
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readSrc(file);
      for (const tag of iterateOpenTags(content, ["div", "span"])) {
        const { name, attrs, openIdx } = tag;
        if (/\baria-hidden=("true"|\{true\})/.test(attrs)) continue;
        if (/\bon(Click|KeyDown|KeyUp|Submit)=\{/.test(attrs)) {
          violations.push(
            `${file}:${lineNumber(content, openIdx)}  <${name}> with handler — use <button> or <Link>`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Audited surface coverage + exception-entry shape
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · governance shape", () => {
  it("at least one audited surface and at least one matched file", () => {
    expect(AUDITED_SURFACES.length).toBeGreaterThan(0);
    expect(auditedFiles.length).toBeGreaterThan(0);
  });

  it("every exception entry has a valid shape (file exists, removeBy valid, reason set)", () => {
    const allLists: ReadonlyArray<{
      name: string;
      entries: ReadonlyArray<ExceptionEntry>;
    }> = [
      { name: "TOUCH_TARGET_EXCEPTIONS", entries: TOUCH_TARGET_EXCEPTIONS },
      { name: "WEB_API_GUARD_EXCEPTIONS", entries: WEB_API_GUARD_EXCEPTIONS },
      { name: "COPY_LINT_EXCEPTIONS", entries: COPY_LINT_EXCEPTIONS },
      { name: "EMPTY_HANDLER_PLACEHOLDERS", entries: EMPTY_HANDLER_PLACEHOLDERS },
      { name: "EFFECT_CLEANUP_EXCEPTIONS", entries: EFFECT_CLEANUP_EXCEPTIONS },
      {
        name: "PRIMITIVE_ADOPTION_EXCEPTIONS",
        entries: PRIMITIVE_ADOPTION_EXCEPTIONS,
      },
    ];
    const violations: string[] = [];
    for (const { name, entries } of allLists) {
      for (const e of entries) {
        if (!e.file || typeof e.file !== "string") {
          violations.push(`${name}  entry missing file`);
          continue;
        }
        if (!existsSync(join(ROOT, e.file))) {
          violations.push(`${name}/${e.file}  file does not exist`);
        }
        if (!e.reason || e.reason.trim().length < 8) {
          violations.push(
            `${name}/${e.file}  reason missing or too short (<8 chars)`,
          );
        }
        if (!VALID_REMOVE_BY.has(e.removeBy)) {
          violations.push(
            `${name}/${e.file}  invalid removeBy "${e.removeBy}"`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
