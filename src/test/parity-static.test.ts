import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  AUDITED_SURFACES,
  FORBIDDEN_SUFFIX_LEGACY,
  HEX_EXCEPTIONS,
} from "./parity-allowlist";

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
  .filter((f) => /\.(tsx?|jsx?|css)$/.test(f))
  .filter((f) => !/\.(test|spec|stories)\.[tj]sx?$/.test(f));

const AUDITED_PATTERNS = AUDITED_SURFACES.flatMap((s) => s.files);
const auditedFiles = ALL_FILES.filter((f) => matchesAny(f, AUDITED_PATTERNS));

function lineNumber(content: string, idx: number): number {
  return content.slice(0, idx).split("\n").length;
}

// ───────────────────────── Global invariants ─────────────────────────────────

describe("Parity gate · global invariants (entire src/)", () => {
  it("no forbidden suffixes in filenames (V2/Old/New*/Better*/legacy-)", () => {
    const violations = ALL_FILES.filter(
      (f) =>
        /(V2\.[tj]sx?$|\/New[A-Z][^/]*\.[tj]sx?$|\/Better[A-Z][^/]*\.[tj]sx?$|Old\.[tj]sx?$|legacy-)/.test(
          f,
        ) && f !== "src/styles/legacy-aliases.css",
    );
    expect(violations).toEqual([]);
  });

  it("no forbidden suffixes on exported identifiers", () => {
    const re =
      /\bexport\s+(?:default\s+)?(?:function|const|class)\s+(?:[A-Za-z][\w]*(?:V2|Old)|(?:New|Better)[A-Z][\w]*)\b/;
    const allowlisted = new Set(FORBIDDEN_SUFFIX_LEGACY.map((e) => e.file));
    const violations = ALL_FILES.filter((f) => /\.(tsx?|jsx?)$/.test(f))
      .map((f) => ({ file: f, content: readFileSync(join(ROOT, f), "utf8") }))
      .filter(({ content }) => re.test(content))
      .map(({ file }) => file)
      .filter((f) => !allowlisted.has(f));
    expect(violations).toEqual([]);
  });
});

// ───────────────────────── Audited-surface invariants ────────────────────────

describe("Parity gate · audited surfaces", () => {
  it("at least one surface declared and matched", () => {
    expect(AUDITED_SURFACES.length).toBeGreaterThan(0);
    expect(auditedFiles.length).toBeGreaterThan(0);
  });

  it("no hex/rgb/oklch literals (line-anchored brand-SVG exceptions only)", () => {
    const re = /(#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|oklch\()/g;
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!/\.(tsx?|jsx?)$/.test(file)) continue;
      const content = readFileSync(join(ROOT, file), "utf8");
      const exceptionsForFile = HEX_EXCEPTIONS.filter((e) => e.file === file).map(
        (e) => e.hex.toUpperCase(),
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const lit = m[0];
        const exempted =
          lit.startsWith("#") && exceptionsForFile.includes(lit.toUpperCase());
        if (!exempted) {
          violations.push(`${file}:${lineNumber(content, m.index)}  ${lit}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("no primitive token leaks (--warm-*, --olive-*, --terra-*, --info-*, --gray-*, --success/warning/error-*)", () => {
    const re = /--(?:warm|olive|terra|info|gray|success|warning|error)-\d+/g;
    const violations: string[] = [];
    for (const file of auditedFiles) {
      const content = readFileSync(join(ROOT, file), "utf8");
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        violations.push(`${file}:${lineNumber(content, m.index)}  ${m[0]}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("button-styled <Link> overrides a:hover with hover:text + hover:no-underline", () => {
    // base.css ships `a:hover { color: var(--color-text-link-hover); text-decoration: underline }`
    // at specificity (0,1,1), which beats Tailwind's `text-[var(--color-...)]` arbitrary
    // class at (0,1,0). Any <Link> styled as a button (custom bg + custom text color)
    // must declare both `hover:text-[...]` and `hover:no-underline` to outrank a:hover,
    // otherwise the text becomes the link-hover color (often invisible on the bg).
    const linkRe =
      /<Link\b[^>]*\bclassName=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g;
    const violations: string[] = [];
    for (const file of auditedFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readFileSync(join(ROOT, file), "utf8");
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(content)) !== null) {
        const cls = m[1] ?? m[2] ?? m[3] ?? "";
        const isButtonStyled = /\bbg-\[var\(--color-/.test(cls);
        const hasCustomText = /\btext-\[var\(--color-/.test(cls);
        if (!isButtonStyled || !hasCustomText) continue;
        const missing: string[] = [];
        if (!/\bhover:text-\[var\(--color-/.test(cls))
          missing.push("hover:text-[var(--color-...)]");
        if (!/\bhover:no-underline\b/.test(cls)) missing.push("hover:no-underline");
        if (missing.length) {
          violations.push(
            `${file}:${lineNumber(content, m.index)}  <Link> missing ${missing.join(" + ")}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
