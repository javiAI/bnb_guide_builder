/**
 * Stub markdown renderer for `GuideTree`. Produces a deterministic string
 * that end-to-end tests can snapshot before 9B ships the full renderer.
 *
 * Output contract (9A only, 9B will expand):
 *   # <propertyId> — audiencia: <audience>
 *
 *   ## <section.label>
 *   - **<item.label>**: <item.value>
 *     - <field.label>: <field.value>
 *   _Sin elementos. <emptyCtaDeepLink>_
 */

import type { GuideTree } from "@/lib/types/guide-tree";

export function renderMarkdown(tree: GuideTree): string {
  const out: string[] = [];
  out.push(`# ${tree.propertyId} — audiencia: ${tree.audience}`);
  out.push("");
  for (const section of tree.sections) {
    out.push(`## ${section.label}`);
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
      const deprecatedMark = item.deprecated ? " _(deprecated)_" : "";
      const value = item.value ? `: ${item.value}` : "";
      out.push(`- **${item.label}**${deprecatedMark}${value}`);
      for (const f of item.fields) {
        out.push(`  - ${f.label}: ${f.value}`);
      }
    }
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}
