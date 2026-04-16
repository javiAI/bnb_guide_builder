/**
 * Markdown renderer for `GuideTree` — deterministic, snapshot-friendly output.
 *
 * Output contract:
 *   # <propertyId> — audiencia: <audience>
 *   _Generado: <generatedAt ISO>_
 *
 *   ## <section.label>
 *   - **<item.label>**: <item.value>
 *     - <field.label>: <field.value>
 *     - ![caption](url)
 *     - **<child.label>**: <child.value>
 *       - <childField.label>: <childField.value>
 *   _Sin elementos. <emptyCtaDeepLink>_
 */

import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";

function escapeMd(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([[\]()\\*_~`#|!])/g, "\\$1");
}

function isSafeMdUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function renderItem(item: GuideItem, depth: number, out: string[]): void {
  const indent = "  ".repeat(depth);
  const deprecatedMark = item.deprecated ? " _(deprecated)_" : "";
  const value = item.value ? `: ${escapeMd(item.value)}` : "";
  out.push(`${indent}- **${escapeMd(item.label)}**${deprecatedMark}${value}`);
  const nestedIndent = "  ".repeat(depth + 1);
  for (const f of item.fields) {
    out.push(`${nestedIndent}- ${escapeMd(f.label)}: ${escapeMd(f.value)}`);
  }
  for (const m of item.media) {
    if (!isSafeMdUrl(m.url)) continue;
    const caption = escapeMd(m.caption ?? "");
    const safeUrl = m.url.replace(/[() ]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
    out.push(`${nestedIndent}- ![${caption}](${safeUrl})`);
  }
  for (const child of item.children) {
    renderItem(child, depth + 1, out);
  }
}

export function renderMarkdown(tree: GuideTree): string {
  const out: string[] = [];
  out.push(`# ${escapeMd(tree.propertyId)} — audiencia: ${escapeMd(tree.audience)}`);
  out.push(`_Generado: ${tree.generatedAt}_`);
  out.push("");
  for (const section of tree.sections) {
    out.push(`## ${escapeMd(section.label)}`);
    if (section.items.length === 0) {
      out.push(
        section.emptyCtaDeepLink
          ? `_Sin elementos. ${section.emptyCtaDeepLink}_`
          : "_Sin elementos._",
      );
      out.push("");
      continue;
    }
    for (const item of section.items) {
      renderItem(item, 0, out);
    }
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}
