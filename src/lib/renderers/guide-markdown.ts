/**
 * Markdown renderer for `GuideTree` — deterministic, snapshot-friendly output.
 *
 * Output contract (non-guest audiences include a debug header):
 *   # <propertyId> — audiencia: <audience>    ← omitted for guest
 *   _Generado: <generatedAt ISO>_             ← omitted for guest
 *
 *   ## <section.label>
 *   - **<item.label>**: <item.value>
 *     - <field.label>: <field.value>
 *     - ![alt](variants.md) — optional *caption*
 *     - **<child.label>**: <child.value>
 *       - <childField.label>: <childField.value>
 *   _Sin elementos. <emptyCtaDeepLink>_
 *
 * Media: renders the `md` (800px) variant inline, cap 3 per item so the
 * markdown output stays scannable. Richer galleries (lightbox, all variants)
 * arrive with 10E React renderer.
 */

import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";
import {
  filterRenderableItems,
  resolveDisplayFields,
  resolveDisplayValue,
  resolveEmptyCopy,
  shouldHideSection,
} from "./_guide-display";

/** Cap inline images per item — keeps markdown output scannable. */
const INLINE_MEDIA_CAP = 3;

function escapeMd(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([[\]()\\*_~`#|!])/g, "\\$1");
}

function isSafeMdUrl(url: string): boolean {
  return /^(\/g\/[^/]+\/|https?:\/\/)/i.test(url);
}

function encodeMdUrl(url: string): string {
  return url.replace(/[() ]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function renderItem(item: GuideItem, depth: number, out: string[]): void {
  const indent = "  ".repeat(depth);
  const deprecatedMark = item.deprecated ? " _(deprecated)_" : "";
  const displayValue = resolveDisplayValue(item);
  const value = displayValue !== null ? `: ${escapeMd(displayValue)}` : "";
  out.push(`${indent}- **${escapeMd(item.label)}**${deprecatedMark}${value}`);
  const nestedIndent = "  ".repeat(depth + 1);
  for (const f of resolveDisplayFields(item)) {
    out.push(`${nestedIndent}- ${escapeMd(f.label)}: ${escapeMd(f.value)}`);
  }
  let emitted = 0;
  for (const m of item.media) {
    if (emitted >= INLINE_MEDIA_CAP) break;
    const url = m.variants.md;
    if (!isSafeMdUrl(url)) continue;
    const alt = escapeMd(m.alt);
    const safeUrl = encodeMdUrl(url);
    const captionSuffix = m.caption ? ` *${escapeMd(m.caption)}*` : "";
    out.push(`${nestedIndent}- ![${alt}](${safeUrl})${captionSuffix}`);
    emitted++;
  }
  for (const child of item.children) {
    renderItem(child, depth + 1, out);
  }
}

export function renderMarkdown(tree: GuideTree): string {
  const out: string[] = [];
  if (tree.audience !== "guest") {
    out.push(`# ${escapeMd(tree.propertyId)} — audiencia: ${escapeMd(tree.audience)}`);
    out.push(`_Generado: ${tree.generatedAt}_`);
    out.push("");
  }
  for (const section of tree.sections) {
    const renderable = filterRenderableItems(section.items, tree.audience);
    if (shouldHideSection(section, tree.audience, renderable)) continue;
    out.push(`## ${escapeMd(section.label)}`);
    if (renderable.length === 0) {
      const guestCopy = resolveEmptyCopy(section, tree.audience);
      if (guestCopy) {
        out.push(`_${escapeMd(guestCopy)}_`);
      } else if (tree.audience !== "guest" && section.emptyCtaDeepLink) {
        out.push(`_Sin elementos. ${section.emptyCtaDeepLink}_`);
      } else if (tree.audience !== "guest") {
        out.push("_Sin elementos._");
      }
      out.push("");
      continue;
    }
    for (const item of renderable) {
      renderItem(item, 0, out);
    }
    if (section.resolverKey === "local") {
      // Map + events are interactive in the web guide; in the static
      // markdown export we note their existence.
      out.push("");
      out.push("> _Mapa y próximos eventos disponibles en la guía online._");
    }
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}
