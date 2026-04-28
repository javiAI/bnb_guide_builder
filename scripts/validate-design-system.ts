/**
 * Validates the integrity of the `design-system/` package.
 *
 * Runs as a CI gate on every PR (unconditional, unit job) and as a
 * local pre-commit check. Catches:
 *   1. Missing required structure
 *   2. Empty mandatory docs/styles/tokens
 *   3. tokens.json malformed, has legacy keys, or references missing primitives
 *   4. tailwind.tokens.ts missing the `warmAnalyticalTheme` export
 *   5. Dark coverage gaps in semantic.css
 *   6. Reference CSS missing the REFERENCE ONLY header
 *   7. Residue files (.DS_Store, __MACOSX, index_v1.html)
 *   8. .gitignore patterns silently re-ignoring the package
 *
 * Usage:
 *   npm run validate:design-system
 *   tsx scripts/validate-design-system.ts
 *
 * Exit code: 0 on success, 1 on any check failure. All failures are reported
 * before exit (no short-circuit) so a single run shows the full picture.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..");
const PKG_ROOT = join(REPO_ROOT, "design-system");
const FOUNDATIONS = join(PKG_ROOT, "foundations");
const REFERENCES = join(PKG_ROOT, "references", "liora-ui-kits");

const failures: string[] = [];

function fail(check: string, detail: string): void {
  failures.push(`[${check}] ${detail}`);
}

function ok(check: string, detail: string): void {
  console.log(`✓ ${check}: ${detail}`);
}

function readFileOrFail(path: string, check: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    fail(check, `cannot read ${relative(REPO_ROOT, path)}`);
    return null;
  }
}

function check1Structure(): void {
  const dirs = [
    join(FOUNDATIONS, "docs"),
    join(FOUNDATIONS, "styles"),
    join(FOUNDATIONS, "tokens"),
    REFERENCES,
  ];
  for (const dir of dirs) {
    try {
      if (!statSync(dir).isDirectory()) {
        fail("structure", `${relative(REPO_ROOT, dir)} is not a directory`);
      }
    } catch {
      fail("structure", `missing required directory ${relative(REPO_ROOT, dir)}`);
    }
  }
  if (failures.length === 0) ok("structure", "all required directories present");
}

function check2MandatoryFiles(): void {
  const files = [
    join(FOUNDATIONS, "docs", "DESIGN_SYSTEM.md"),
    join(FOUNDATIONS, "docs", "IMPLEMENTATION.md"),
    join(FOUNDATIONS, "docs", "ACCESSIBILITY.md"),
    join(FOUNDATIONS, "docs", "Foundation.html"),
    join(FOUNDATIONS, "styles", "base.css"),
    join(FOUNDATIONS, "styles", "themes.css"),
    join(FOUNDATIONS, "tokens", "primitives.css"),
    join(FOUNDATIONS, "tokens", "semantic.css"),
    join(FOUNDATIONS, "tokens", "components.css"),
    join(FOUNDATIONS, "tokens", "shadcn.css"),
    join(FOUNDATIONS, "tokens", "tailwind.tokens.ts"),
    join(FOUNDATIONS, "tokens", "tokens.json"),
  ];
  let okCount = 0;
  for (const path of files) {
    try {
      const stat = statSync(path);
      if (!stat.isFile()) {
        fail("mandatory-files", `${relative(REPO_ROOT, path)} is not a file`);
        continue;
      }
      if (stat.size === 0) {
        fail("mandatory-files", `${relative(REPO_ROOT, path)} is empty (0 bytes)`);
        continue;
      }
      okCount++;
    } catch {
      fail("mandatory-files", `missing ${relative(REPO_ROOT, path)}`);
    }
  }
  if (okCount === files.length) {
    ok("mandatory-files", `${files.length} files present and non-empty`);
  }
}

interface TokenNode {
  $value?: string;
  $type?: string;
  $description?: string;
  [key: string]: unknown;
}

function collectTokenPaths(
  node: unknown,
  prefix: string[],
  out: Set<string>,
): void {
  if (typeof node !== "object" || node === null) return;
  const obj = node as Record<string, unknown>;
  if ("$value" in obj) {
    out.add(prefix.join("."));
    return;
  }
  for (const [key, child] of Object.entries(obj)) {
    if (key.startsWith("$")) continue;
    collectTokenPaths(child, [...prefix, key], out);
  }
}

function collectTokenReferences(
  node: unknown,
  out: Set<string>,
): void {
  if (typeof node !== "object" || node === null) return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.$value === "string") {
    const matches = obj.$value.matchAll(/\{([^}]+)\}/g);
    for (const m of matches) out.add(m[1]);
  }
  for (const [key, child] of Object.entries(obj)) {
    if (key.startsWith("$")) continue;
    collectTokenReferences(child, out);
  }
}

function check3TokensJson(): void {
  const path = join(FOUNDATIONS, "tokens", "tokens.json");
  const raw = readFileOrFail(path, "tokens-json");
  if (raw === null) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail("tokens-json", `invalid JSON: ${(err as Error).message}`);
    return;
  }

  const declared = new Set<string>();
  collectTokenPaths(parsed, [], declared);
  const refs = new Set<string>();
  collectTokenReferences(parsed, refs);

  const legacyKeys = [...declared].filter((p) => /\.(success|warning)\.300$/.test(p));
  if (legacyKeys.length > 0) {
    fail(
      "tokens-json",
      `legacy keys present: ${legacyKeys.join(", ")} (must be removed)`,
    );
  }

  const missing: string[] = [];
  for (const ref of refs) {
    if (!declared.has(ref)) missing.push(ref);
  }
  if (missing.length > 0) {
    fail(
      "tokens-json",
      `${missing.length} reference(s) point to undeclared tokens: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
    );
  } else {
    ok(
      "tokens-json",
      `valid JSON, no legacy keys, ${declared.size} tokens / ${refs.size} refs all resolve`,
    );
  }
}

function check4TailwindExport(): void {
  const path = join(FOUNDATIONS, "tokens", "tailwind.tokens.ts");
  const raw = readFileOrFail(path, "tailwind-export");
  if (raw === null) return;
  if (!/export\s+(const|let|var)\s+warmAnalyticalTheme\b/.test(raw)) {
    fail("tailwind-export", "missing `export const warmAnalyticalTheme` in tailwind.tokens.ts");
    return;
  }
  ok("tailwind-export", "warmAnalyticalTheme exported");
}

function check5DarkCoverage(): void {
  const path = join(FOUNDATIONS, "tokens", "semantic.css");
  const raw = readFileOrFail(path, "dark-coverage");
  if (raw === null) return;

  const rootMatch = raw.match(/:root\s*\{([\s\S]*?)\n\}/);
  const darkMatch = raw.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
  if (!rootMatch) {
    fail("dark-coverage", "no `:root { … }` block found in semantic.css");
    return;
  }
  if (!darkMatch) {
    fail("dark-coverage", "no `[data-theme=\"dark\"] { … }` block found in semantic.css");
    return;
  }

  const colorTokenRe = /(--color-[a-z0-9-]+)\s*:/g;
  const rootColors = new Set<string>();
  for (const m of rootMatch[1].matchAll(colorTokenRe)) rootColors.add(m[1]);
  const darkColors = new Set<string>();
  for (const m of darkMatch[1].matchAll(colorTokenRe)) darkColors.add(m[1]);

  const uncovered = [...rootColors].filter((t) => !darkColors.has(t));
  if (uncovered.length > 0) {
    fail(
      "dark-coverage",
      `${uncovered.length} color token(s) lack dark binding: ${uncovered.slice(0, 5).join(", ")}${uncovered.length > 5 ? "…" : ""}`,
    );
    return;
  }
  ok("dark-coverage", `all ${rootColors.size} --color-* tokens have dark bindings`);
}

function check6ReferenceHeader(): void {
  const path = join(REFERENCES, "colors_and_type.css");
  const raw = readFileOrFail(path, "reference-header");
  if (raw === null) return;
  const head = raw.slice(0, 200);
  if (!head.includes("REFERENCE ONLY")) {
    fail(
      "reference-header",
      "colors_and_type.css must start with a `REFERENCE ONLY` header (first 200 chars do not contain it)",
    );
    return;
  }
  ok("reference-header", "colors_and_type.css carries REFERENCE ONLY header");
}

async function walkDir(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(full + "/");
      await walkDir(full, out);
    } else {
      out.push(full);
    }
  }
}

async function check7Residues(): Promise<void> {
  const all: string[] = [];
  await walkDir(PKG_ROOT, all);
  const offenders = all.filter((p) => {
    const base = p.replace(/\/$/, "").split("/").pop() ?? "";
    return base === ".DS_Store" || base === "__MACOSX" || base === "index_v1.html";
  });
  if (offenders.length > 0) {
    fail(
      "residues",
      `${offenders.length} residue file(s) found: ${offenders
        .slice(0, 5)
        .map((p) => relative(REPO_ROOT, p))
        .join(", ")}${offenders.length > 5 ? "…" : ""}`,
    );
    return;
  }
  ok("residues", "no .DS_Store / __MACOSX / index_v1.html in package");
}

function check8GitignoreHardening(): void {
  const samples = [
    "design-system/foundations/tokens/tokens.json",
    "design-system/references/liora-ui-kits/REFERENCE_RULES.md",
    "design-system/foundations/styles/base.css",
  ];
  const ignored: string[] = [];
  for (const sample of samples) {
    const result = spawnSync("git", ["check-ignore", sample], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    if (result.status === 0) ignored.push(sample);
  }
  if (ignored.length > 0) {
    fail(
      "gitignore-hardening",
      `${ignored.length} package path(s) ignored by .gitignore: ${ignored.join(", ")} — remove the matching pattern`,
    );
    return;
  }
  ok("gitignore-hardening", "no .gitignore pattern silently ignores the package");
}

async function main(): Promise<void> {
  console.log(`Validating design-system package at ${relative(REPO_ROOT, PKG_ROOT)}/\n`);

  check1Structure();
  check2MandatoryFiles();
  check3TokensJson();
  check4TailwindExport();
  check5DarkCoverage();
  check6ReferenceHeader();
  await check7Residues();
  check8GitignoreHardening();

  console.log("");
  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} check(s) failed:\n`);
    for (const f of failures) console.error(`  ${f}`);
    console.error("");
    process.exit(1);
  }
  console.log("All checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
