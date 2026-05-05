import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  AUDITED_SURFACES,
  BUTTON_LINK_SIZE_SM_EXCEPTIONS,
  COPY_LINT_EXCEPTIONS,
  CURRENT_LIORA_PHASE,
  EFFECT_CLEANUP_EXCEPTIONS,
  EMPTY_HANDLER_PLACEHOLDERS,
  EXPECTED_OPERATOR_SCOPE_PATTERNS,
  LIORA_PHASE_ORDER,
  LIORA_PRIMITIVE_IMPORT_PATHS,
  ORPHAN_AUDIT_PENDING_EXCEPTIONS,
  PRIMITIVE_ADOPTION_EXCEPTIONS,
  TOUCH_TARGET_EXCEPTIONS,
  WEB_API_GUARD_EXCEPTIONS,
  type ExceptionEntry,
  type LioraPhase,
  type RemoveBy,
  type SurfaceProfile,
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

/**
 * Files matched by audited surfaces with one of the given profiles. Used to
 * scope operator-only invariants (primitive-adoption, command-bar slot,
 * Spanish copy-lint, ButtonLink size=sm) so they don't fire on guest
 * surfaces — guest applies a different visual system on purpose.
 */
function auditedFilesByProfile(
  ...profiles: ReadonlyArray<SurfaceProfile>
): string[] {
  const allowed = new Set(profiles);
  const patterns = AUDITED_SURFACES.filter((s) => allowed.has(s.profile)).flatMap(
    (s) => s.files,
  );
  return ALL_FILES.filter((f) => matchesAny(f, patterns));
}

const operatorAuditedFiles = auditedFilesByProfile("operator", "shared");

/**
 * Strip JS line and block comments while preserving line numbers (replace
 * comment chars with whitespace so `lineNumber()` reports the source line).
 * The brace-aware JSX walker would otherwise see `<button>` references inside
 * doc comments and count them as nested tags. String literals (single, double,
 * template) are skipped so a `// in a string` is not stripped.
 */
function stripJsComments(content: string): string {
  let out = "";
  let i = 0;
  let str: '"' | "'" | "`" | null = null;
  while (i < content.length) {
    const c = content[i];
    const next = content[i + 1];
    if (str) {
      if (c === "\\" && i + 1 < content.length) {
        out += c + content[i + 1];
        i += 2;
        continue;
      }
      if (c === str) str = null;
      out += c;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      str = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = content.indexOf("*/", i + 2);
      if (end < 0) {
        out += " ".repeat(content.length - i);
        return out;
      }
      out += content.slice(i, end + 2).replace(/[^\n]/g, " ");
      i = end + 2;
      continue;
    }
    if (c === "/" && next === "/") {
      const end = content.indexOf("\n", i);
      const stop = end < 0 ? content.length : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const fileCache = new Map<string, string>();
function readSrc(file: string): string {
  let cached = fileCache.get(file);
  if (cached === undefined) {
    cached = stripJsComments(readFileSync(join(ROOT, file), "utf8"));
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

/**
 * Extract a flat class-token string from a JSX `className=` attribute, covering
 * the shapes used in this codebase:
 *   - className="foo bar"
 *   - className={"foo bar"}
 *   - className={`foo bar`}
 *   - className={cn("foo", isActive && "bar", `baz`)}
 *   - className={clsx("foo", "bar")}
 *
 * For `cn(...)` / `clsx(...)`, all string-literal arguments are concatenated
 * (separated by spaces). Non-literal args (variables, imported constants) are
 * invisible — that limitation is intentional: a static walker can't follow
 * runtime values, and primitives that compose classes via constants are
 * audited via the `primitive-adoption` test, not this regex layer.
 *
 * Returns `null` when no className attribute is found.
 */
function extractClassName(attrs: string): string | null {
  const lit = attrs.match(
    /\bclassName=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/,
  );
  if (lit) return lit[1] ?? lit[2] ?? lit[3] ?? "";
  const callMatch = attrs.match(/\bclassName=\{(?:cn|clsx)\(/);
  if (!callMatch || callMatch.index === undefined) return null;
  const startIdx = callMatch.index + callMatch[0].length;
  let parenDepth = 1;
  let i = startIdx;
  let collected = "";
  let str: '"' | "'" | "`" | null = null;
  while (i < attrs.length) {
    const c = attrs[i];
    if (str) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === str) {
        str = null;
        collected += " ";
        i++;
        continue;
      }
      collected += c;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      str = c;
      i++;
      continue;
    }
    if (c === "(") {
      parenDepth++;
      i++;
      continue;
    }
    if (c === ")") {
      parenDepth--;
      if (parenDepth === 0) return collected;
      i++;
      continue;
    }
    i++;
  }
  return collected;
}

const VALID_REMOVE_BY: ReadonlySet<RemoveBy> = new Set([
  ...LIORA_PHASE_ORDER,
  "never" as const,
]);

/**
 * Returns true when `candidate` is a Liora phase that has already passed
 * relative to `current` (i.e. an exception with `removeBy = candidate`
 * promised cleanup before we reached `current` and shipped without it).
 */
function isPhaseInPast(candidate: LioraPhase, current: LioraPhase): boolean {
  const ci = LIORA_PHASE_ORDER.indexOf(candidate);
  const cu = LIORA_PHASE_ORDER.indexOf(current);
  return ci >= 0 && cu >= 0 && ci < cu;
}

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
        if (/\bdisabled\b(?!=)/.test(attrs)) continue;
        const cls = extractClassName(attrs);
        if (cls === null) continue;
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
        // Height signals that meet 44 visual on their own.
        const heightTokens = [
          "min-h-[44px]",
          "min-h-11",
          "min-h-12",
          "h-11",
          "h-12",
          "h-14",
          "h-16",
        ];
        // Width signals — required when the button-shape is fixed-square
        // (icon-only). `min-h-[44px]` alone is the text-bearing pattern (44
        // floor, content drives width, not a fixed square) and is exempted.
        // `recipe-icon-btn-32` bakes both dimensions via the pseudo-element +
        // coarse-pointer media query; no width signal needed.
        const widthTokens = [
          "min-w-[44px]",
          "min-w-11",
          "min-w-12",
          "w-11",
          "w-12",
          "w-14",
          "w-16",
        ];
        const hasSlop = cls.includes("recipe-icon-btn-32");
        const hasHeight = heightTokens.some((t) => cls.includes(t));
        const hasWidth = widthTokens.some((t) => cls.includes(t));
        const isTextBearingFloor =
          cls.includes("min-h-[44px]") && !cls.includes("recipe-icon-btn-32");
        const reaches44 =
          hasSlop || (hasHeight && (isTextBearingFloor || hasWidth));
        if (!reaches44) {
          const reason = !hasHeight
            ? "missing min-h-[44px] / h-11 / recipe-icon-btn-32"
            : "icon-shaped (fixed height) — also needs w-11 / min-w-[44px] or recipe-icon-btn-32";
          violations.push(
            `${file}:${lineNumber(content, openIdx)}  <${name}> button-shaped but ${reason}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("buttons/links with small fixed dimensions declare a compensating 44-hit-area class", () => {
    // Capture buttons with explicit small heights/padding that lack a 44-hit-area
    // compensator. Example: `h-6 w-6` delete buttons without `min-h-[44px]` or
    // `h-11`. Scoped to operator/shared — guest buttons have different size rules.
    // Matches: h-6, h-7, h-8, p-0.5, p-1, p-1.5, px-1, py-1, etc.
    const smallDimensionRe = /\b(h-[678]|p-0\.5|p-1(?:\.[5])?|p[xy]-0\.5|p[xy]-1|p[xy]-1\.5)\b/;
    const validCompensators = [
      "min-h-[44px]",
      "min-h-11",
      "min-w-[44px]",
      "min-w-11",
      "h-11",
      "h-12",
      "h-14",
      "h-16",
      "w-11",
      "w-12",
      "recipe-icon-btn-32",
    ];
    const violations: string[] = [];
    for (const file of operatorAuditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readSrc(file);
      for (const tag of iterateOpenTags(content, ["button", "Link", "a"])) {
        const { name, attrs, openIdx } = tag;
        if (/\baria-hidden=("true"|\{true\})/.test(attrs)) continue;
        if (/\bdisabled\b(?!=)/.test(attrs)) continue;
        const cls = extractClassName(attrs);
        if (cls === null) continue;
        // Detect small-dimension marker
        if (!smallDimensionRe.test(cls)) continue;
        // Check for compensating 44-hit-area class
        const hasCompensator = validCompensators.some((t) => cls.includes(t));
        if (!hasCompensator) {
          violations.push(
            `${file}:${lineNumber(content, openIdx)}  <${name}> has small size (h-6/h-7/h-8/p-1/p-1.5) but lacks 44-hit-area class (min-h-[44px]/h-11/recipe-icon-btn-32)`,
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

  it("no form controls (<input>/<select>/<textarea>) nested inside <button>", () => {
    // Invalid HTML nesting — form controls cannot be interactive descendants
    // of a button. Example from PR #100: `<input type="file">` was nested
    // inside the dropzone `<button>`, breaking form control semantics.
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readSrc(file);
      for (const tag of iterateOpenTags(content, ["button"])) {
        const attrEnd = tag.openIdx + 1 + tag.name.length + tag.attrs.length + 1;
        const closingIdx = content.indexOf("</button>", attrEnd);
        if (closingIdx < 0) continue;
        const inner = content.slice(attrEnd, closingIdx);
        if (/<input\b|<select\b|<textarea\b/.test(inner)) {
          violations.push(
            `${file}:${lineNumber(content, tag.openIdx)}  <button> contains nested form control (<input>/<select>/<textarea>)`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("no block elements (<div>/<p>/<section>) nested inside <button>", () => {
    // Invalid HTML nesting — block-level elements have semantics that break
    // inside button context. Browser repair is inconsistent. Example: a
    // dropzone `<button>` with nested `<div>` + `<p>` loses affordance.
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readSrc(file);
      for (const tag of iterateOpenTags(content, ["button"])) {
        const attrEnd = tag.openIdx + 1 + tag.name.length + tag.attrs.length + 1;
        const closingIdx = content.indexOf("</button>", attrEnd);
        if (closingIdx < 0) continue;
        const inner = content.slice(attrEnd, closingIdx);
        if (/<div\b|<p\b|<section\b|<article\b|<header\b|<footer\b|<main\b/.test(inner)) {
          violations.push(
            `${file}:${lineNumber(content, tag.openIdx)}  <button> contains nested block element (<div>/<p>/<section>/...)`,
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
    // Operator-only invariant: guest surfaces have their own copy contract
    // (multilingual; English is allowed). Scope to operator + shared per the
    // describe block — iterating auditedFiles would falsely flag guest copy.
    for (const file of operatorAuditedFiles) {
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

describe("Component invariants · command-bar slot non-interactive (operator)", () => {
  // Scope: operator only — guest surfaces don't have a command-bar slot.
  it("command-bar-slot.tsx is aria-hidden + has no interactive handlers", () => {
    const file = "src/components/layout/command-bar-slot.tsx";
    if (!operatorAuditedFiles.includes(file)) {
      // Defensive: only run when the file is in scope under operator/shared
      // profile. Today it is via `src/components/layout/**/*.tsx`.
      return;
    }
    const content = readSrc(file);
    expect(content).toMatch(/aria-hidden=("true"|\{true\})/);
    expect(content).not.toMatch(/\bon(Click|Change|Input|KeyDown|KeyUp|Submit)=/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Primitive adoption (overview shell → <Card variant="overview">)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · primitive adoption (operator)", () => {
  // Scope: operator only. Guest surfaces use `src/components/public-guide/ui/`
  // primitives (CVA-based hero/essential/standard/warning cards) — they have
  // their own visual system and must not be forced into the operator shell.
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
    for (const file of overviewFiles) {
      if (exempt(file, PRIMITIVE_ADOPTION_EXCEPTIONS)) continue;
      const content = readSrc(file);
      for (const tag of iterateOpenTags(content, ["div"])) {
        const cls = extractClassName(tag.attrs);
        if (cls === null) continue;
        // Two equivalent canonical-shell signatures: the literal token bag,
        // or the recipe-card-shell class (which @applies the same tokens).
        // Either form on a raw <div> in overview/ must be migrated to <Card variant="overview">.
        const hasLiteralShell = required.every((token) => cls.includes(token));
        const hasRecipeShell = /\brecipe-card-shell\b/.test(cls);
        if (hasLiteralShell || hasRecipeShell) {
          violations.push(
            `${file}:${lineNumber(content, tag.openIdx)}  raw <div> with overview shell — use <Card variant="overview">`,
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

  it("every audited surface declares a profile", () => {
    const violations: string[] = [];
    const validProfiles: ReadonlySet<SurfaceProfile> = new Set([
      "operator",
      "guest",
      "shared",
    ]);
    for (const s of AUDITED_SURFACES) {
      if (!validProfiles.has(s.profile)) {
        violations.push(`${s.id}  invalid profile "${s.profile}"`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("every exception entry has a valid shape (file exists, removeBy valid, reason set, not in the past)", () => {
    // Compound gate: shape (file/reason/removeBy) AND phase expiration.
    // `removeBy < CURRENT_LIORA_PHASE` means a previous rama promised to
    // clean up an exception and shipped without doing so — fail loud.
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
      {
        name: "BUTTON_LINK_SIZE_SM_EXCEPTIONS",
        entries: BUTTON_LINK_SIZE_SM_EXCEPTIONS,
      },
      {
        name: "ORPHAN_AUDIT_PENDING_EXCEPTIONS",
        entries: ORPHAN_AUDIT_PENDING_EXCEPTIONS,
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
          continue;
        }
        if (e.removeBy !== "never" && isPhaseInPast(e.removeBy, CURRENT_LIORA_PHASE)) {
          violations.push(
            `${name}/${e.file}  removeBy "${e.removeBy}" is in the past relative to current phase "${CURRENT_LIORA_PHASE}" — the rama that promised cleanup shipped without it`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Orphan check: every file matching EXPECTED_OPERATOR_SCOPE_PATTERNS or
  // importing a Liora primitive must be in AUDITED_SURFACES (any profile),
  // unless explicitly listed in ORPHAN_AUDIT_PENDING_EXCEPTIONS.
  // ───────────────────────────────────────────────────────────────────────────

  it("every expected-scope file is covered by AUDITED_SURFACES (or pending exception)", () => {
    const expectedFiles = ALL_FILES.filter((f) =>
      matchesAny(f, EXPECTED_OPERATOR_SCOPE_PATTERNS),
    );
    const violations: string[] = [];
    for (const file of expectedFiles) {
      if (auditedFiles.includes(file)) continue;
      if (ORPHAN_AUDIT_PENDING_EXCEPTIONS.some((e) => e.file === file)) continue;
      violations.push(
        `${file}  matches EXPECTED_OPERATOR_SCOPE_PATTERNS but is not in AUDITED_SURFACES (add to AUDITED_SURFACES or ORPHAN_AUDIT_PENDING_EXCEPTIONS)`,
      );
    }
    expect(violations).toEqual([]);
  });

  it("every Liora-touched file (imports primitive) is covered by AUDITED_SURFACES (or pending exception)", () => {
    // Heuristic: if a file imports `@/components/ui/{card,section-eyebrow,
    // icon-badge,text-link,timeline-list,icon-button,icon-button-link,
    // button-link}` or `@/lib/tone`, it has migrated to Liora and must be
    // audited. Catches the failure mode where a future rama refactors a
    // subpage to use a primitive but forgets to add the file/glob to
    // AUDITED_SURFACES.
    // MDN-canonical regex-escape (escapes the full set of regex meta chars
    // including `]` and `\`). Today's primitive paths don't contain any of
    // these, but using the canonical form documents intent and stays robust
    // if a future path adds a hyphen-bracket or similar.
    const importRe = new RegExp(
      `from\\s+["'](?:${LIORA_PRIMITIVE_IMPORT_PATHS.map((p) =>
        p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ).join("|")})["']`,
    );
    const violations: string[] = [];
    for (const file of ALL_FILES) {
      if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
      if (auditedFiles.includes(file)) continue;
      if (ORPHAN_AUDIT_PENDING_EXCEPTIONS.some((e) => e.file === file)) continue;
      // Skip the primitive sources themselves — `timeline-list.tsx` imports
      // `@/lib/tone` legitimately. Only flag CONSUMERS outside the audit.
      const isPrimitiveSource =
        file.startsWith("src/components/ui/") || file === "src/lib/tone.ts";
      if (isPrimitiveSource) continue;
      const content = readSrc(file);
      if (importRe.test(content)) {
        violations.push(
          `${file}  imports a Liora primitive but is not in AUDITED_SURFACES (extend the surface globs or add to ORPHAN_AUDIT_PENDING_EXCEPTIONS)`,
        );
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. ButtonLink size="sm" forbidden on operator/shared audited surfaces
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · <ButtonLink size='sm'> on audited operator surfaces", () => {
  it("no <ButtonLink size=\"sm\"> on operator/shared surfaces (slop on text-bearing button breaks affordance)", () => {
    // ButtonLink does NOT bake recipe-icon-btn-32 for size=sm because slop on
    // a text-bearing button breaks the visual affordance (see
    // design-system/docs/touch-targets.md). On operator/shared audited
    // surfaces the default is size="md" (44 visual). Real exceptions go to
    // BUTTON_LINK_SIZE_SM_EXCEPTIONS with reason + removeBy.
    const re = /<ButtonLink\b[^>]*\bsize=("sm"|\{"sm"\})/g;
    const violations: string[] = [];
    for (const file of operatorAuditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      if (exempt(file, BUTTON_LINK_SIZE_SM_EXCEPTIONS)) continue;
      const content = readSrc(file);
      for (const m of content.matchAll(re)) {
        violations.push(`${file}:${lineNumber(content, m.index ?? 0)}  ${m[0]}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Token consistency (operator surfaces use correct semantic tokens)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · token consistency (error messages)", () => {
  it("error/validation messages use status-error-text tone (not status-error-solid/-icon)", () => {
    // status-error-solid reserves accent red for filled surfaces/buttons.
    // Inline copy (error text, validation feedback) must use status-error-text.
    // In dark mode, -solid is dimmer and lower-contrast. -icon is for icons only.
    // Flag ONLY text- and color- usage; exclude bg- (filled surfaces like hero cards can use -solid correctly).
    const violations: string[] = [];
    for (const file of operatorAuditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readSrc(file);
      // Flag text- and color- use of -solid or -icon; EXCLUDE bg- (filled surfaces)
      const badTokens = /\b(?:text|color)-\[var\(--color-status-error-(solid|icon)\)/g;
      for (const m of content.matchAll(badTokens)) {
        violations.push(
          `${file}:${lineNumber(content, m.index ?? 0)}  uses status-error-${
            m[1]
          } for inline text — must be status-error-text for readability`,
        );
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Layout safety (grid column mismatches, opacity-0 accessibility)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · layout safety", () => {
  it("elements with min-w-[44px] or h-11+ cannot be inside grid-cols-[...24px...]", () => {
    // Grid column mismatch: element min-w-[44px] inside a 24px grid column causes
    // overflow and layout breakage. Pattern: grid-cols-[...24px...] followed by
    // button/div with min-w-[44px]/min-h-[44px]/h-11/recipe-icon-btn-32.
    const violations: string[] = [];
    for (const file of operatorAuditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readSrc(file);
      // Find grid-cols with 24px column
      const gridMatch = /grid-cols-\[([^\]]*24px[^\]]*)\]/.exec(content);
      if (!gridMatch) continue;
      // Check if there's a 44-width element in the next few lines
      const gridIdx = gridMatch.index || 0;
      const nextChunk = content.slice(gridIdx, gridIdx + 1000);
      // Look for buttons/elements with 44-width classes after the grid definition
      if (/\b(min-w-\[44px\]|min-h-\[44px\]|h-11|h-12|recipe-icon-btn-32)\b/.test(nextChunk)) {
        violations.push(
          `${file}:${lineNumber(content, gridIdx)}  grid-cols-[...24px...] has 44-width child element — will cause overflow/misalign`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it("opacity-0 hidden elements must have accessible keyboard alternative", () => {
    // Opacity-0 hide pattern (visibility: hidden on non-hover) without keyboard
    // fallback is inaccessible. Example: `opacity-0 group-hover:opacity-100`
    // button without focus-visible or aria-expanded disclosure.
    // This is complex to validate statically — skip for now, flag in review.
    // TODO: Add this when we have disclosure/focus tracking.
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Accessibility (icon-only buttons, drag handlers)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · accessibility hardening", () => {
  it("icon-only buttons require aria-label or title (no bare Lucide icons)", () => {
    // Icon-only buttons (button with only <Icon />) are invisible to screen readers.
    // Must have aria-label or title to announce purpose.
    // Pattern: <button ...><${IconName}.../></button> without aria-label/title.
    // Exclude primitives (src/components/ui/) which have aria-label as required prop.
    const lucideIconRe = /from\s+["']lucide-react["']/;
    const violations: string[] = [];
    for (const file of operatorAuditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      // Skip primitive definitions (they mandate aria-label via TypeScript)
      if (file.startsWith("src/components/ui/")) continue;
      const content = readSrc(file);
      // Only check files that import Lucide icons
      if (!lucideIconRe.test(content)) continue;
      // Find all <button> tags
      for (const tag of iterateOpenTags(content, ["button"])) {
        const attrEnd = tag.openIdx + 1 + tag.name.length + tag.attrs.length + 1;
        const closingIdx = content.indexOf("</button>", attrEnd);
        if (closingIdx < 0) continue;
        const inner = content.slice(attrEnd, closingIdx).trim();
        // Icon-only if inner content is just a self-closing Lucide component
        // Pattern: <IconName ... /> or <IconName ... ></IconName>
        const isIconOnly = /^<[A-Z]\w+[^>]*\/>$/.test(inner) ||
                          /^<[A-Z]\w+[^>]*>[^<]*<\/[A-Z]\w+>$/.test(inner);
        if (!isIconOnly) continue;
        // Check for aria-label or title
        if (/\b(aria-label|title)=/.test(tag.attrs)) continue;
        // Skip if {...props} spread (props might contain aria-label)
        if (/\{\.\.\.\w+\}/.test(tag.attrs)) continue;
        violations.push(
          `${file}:${lineNumber(content, tag.openIdx)}  icon-only <button> lacks aria-label/title — screen readers won't announce purpose`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it("drag event handlers must preventDefault to prevent browser default", () => {
    // onDrop + onDragOver without preventDefault allow browser to open dragged files.
    // Detect handlers and check handler body for e.preventDefault() or variations.
    // Skip handlers that are function calls — assume the function has preventDefault.
    const violations: string[] = [];
    for (const file of operatorAuditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readSrc(file);
      // Find all onDrop= and onDragOver= handlers
      const dragHandlerRe = /\b(onDrop|onDragOver)=\{([^}]+)\}/g;
      for (const m of content.matchAll(dragHandlerRe)) {
        const handlerName = m[1];
        const handlerBody = m[2];
        // Check if handler calls preventDefault or stopPropagation
        if (/preventDefault|stopPropagation/.test(handlerBody)) continue;
        // If handler is just a reference or function call, skip
        // (e.g. onDrop={handleDrop} or onDrop={(e) => handleDrop(e, index)})
        // Patterns: `funcName` or `funcName(...)` or `(e) => funcName(e, ...)`
        if (/^[a-zA-Z_]\w*(\([^)]*\))?$/.test(handlerBody.trim())) continue; // simple call
        if (/^\([^)]*\)\s*=>\s*[a-zA-Z_]\w*\([^)]*\)$/.test(handlerBody.trim())) continue; // arrow function calling another
        violations.push(
          `${file}:${lineNumber(content, m.index ?? 0)}  ${handlerName} handler lacks preventDefault/stopPropagation — allows browser to open files`,
        );
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Shared primitive compliance (button-size invariants for primitives used on audited surfaces)
// ─────────────────────────────────────────────────────────────────────────────

describe("Component invariants · shared primitive compliance", () => {
  it("NumberStepper step buttons meet 44-hit-area baseline when consumed by audited surfaces", () => {
    // When an operator/shared audited surface imports NumberStepper, the
    // primitive's internal button size must meet the 44-hit-area baseline.
    // Check at the primitive source level (stepBtnCls constant) — static
    // walking of consumer files cannot see constant values, only references.
    const PRIMITIVE = "src/components/ui/number-stepper.tsx";
    const VALID_44_CLASSES = [
      "min-h-[44px]",
      "min-h-11",
      "h-11",
      "h-12",
      "recipe-icon-btn-32",
    ];

    // Find audited consumers
    const auditedConsumers: string[] = [];
    for (const file of operatorAuditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readSrc(file);
      if (/from\s+["']@\/components\/ui\/number-stepper["']/.test(content)) {
        auditedConsumers.push(file);
      }
    }

    // If no consumers, invariant is vacuously true
    if (auditedConsumers.length === 0) return;

    // Check primitive source for at least one valid 44-hit-area class
    const primitiveContent = readSrc(PRIMITIVE);
    const hasValidClass = VALID_44_CLASSES.some((cls) =>
      primitiveContent.includes(cls),
    );

    expect(hasValidClass).toBe(true);
    if (!hasValidClass) {
      expect.fail(
        `NumberStepper (${PRIMITIVE}) uses small buttons (h-8 w-8) but lacks a 44-hit-area class. Consumers: ${auditedConsumers.join(", ")}. Fix stepBtnCls to include min-h-[44px] or h-11.`,
      );
    }
  });
});
