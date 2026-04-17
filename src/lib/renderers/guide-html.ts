/**
 * HTML renderer for `GuideTree`. Every string that comes from DB (labels,
 * values, captions, urls) is escaped — the renderer itself is the only source
 * of HTML structure. No `dangerouslySetInnerHTML`-shaped output ever reaches
 * the caller. Media URLs are validated to http/https/data to prevent
 * `javascript:` href/src injection.
 */

import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";
import {
  filterRenderableItems,
  resolveDisplayFields,
  resolveDisplayValue,
  resolveEmptyCopy,
  shouldHideSection,
} from "./_guide-display";

/** Cap inline images per item — keeps markup lean; lightbox gallery comes in 10E. */
const INLINE_MEDIA_CAP = 3;

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch]);
}

function isSafeUrl(url: string): boolean {
  // Relative paths into the public guide media proxy (`/g/<slug>/media/...`)
  // are the preferred shape — never embed presigned R2 URLs in cacheable HTML.
  return /^(\/g\/[^/]+\/|https?:\/\/|data:image\/(png|jpe?g|gif|webp|avif);)/i.test(
    url,
  );
}

function renderItem(item: GuideItem, out: string[]): void {
  const deprecated = item.deprecated
    ? ' <em class="gt-deprecated">(deprecated)</em>'
    : "";
  const displayValue = resolveDisplayValue(item);
  const value = displayValue !== null ? `: ${escapeHtml(displayValue)}` : "";
  const displayFields = resolveDisplayFields(item);
  out.push(
    `<li><strong>${escapeHtml(item.label)}</strong>${deprecated}${value}`,
  );
  const hasDetails =
    displayFields.length > 0 || item.media.length > 0 || item.children.length > 0;
  if (hasDetails) {
    out.push("<ul>");
    for (const f of displayFields) {
      out.push(
        `<li>${escapeHtml(f.label)}: ${escapeHtml(f.value)}</li>`,
      );
    }
    let emitted = 0;
    for (const m of item.media) {
      if (emitted >= INLINE_MEDIA_CAP) break;
      const src = m.variants.md;
      if (!isSafeUrl(src)) continue;
      const alt = escapeHtml(m.alt);
      const url = escapeHtml(src);
      const captionHtml = m.caption
        ? `<figcaption>${escapeHtml(m.caption)}</figcaption>`
        : "";
      out.push(
        `<li><figure><img src="${url}" alt="${alt}" loading="lazy" />${captionHtml}</figure></li>`,
      );
      emitted++;
    }
    for (const child of item.children) {
      renderItem(child, out);
    }
    out.push("</ul>");
  }
  out.push("</li>");
}

export function renderHtml(tree: GuideTree): string {
  const out: string[] = [];
  out.push("<article class=\"guide-tree\">");
  if (tree.audience !== "guest") {
    out.push(
      `<header><h1>${escapeHtml(tree.propertyId)} — audiencia: ${escapeHtml(
        tree.audience,
      )}</h1><p class="gt-generated">Generado: ${escapeHtml(
        tree.generatedAt,
      )}</p></header>`,
    );
  }
  for (const section of tree.sections) {
    const renderable = filterRenderableItems(section.items, tree.audience);
    if (shouldHideSection(section, tree.audience, renderable)) continue;
    out.push(`<section><h2>${escapeHtml(section.label)}</h2>`);
    if (renderable.length === 0) {
      const guestCopy = resolveEmptyCopy(section, tree.audience);
      if (guestCopy) {
        out.push(`<p class="gt-empty">${escapeHtml(guestCopy)}</p>`);
      } else if (
        tree.audience !== "guest" &&
        section.emptyCtaDeepLink &&
        /^(\/[^/]|https?:\/\/)/i.test(section.emptyCtaDeepLink)
      ) {
        out.push(
          `<p class="gt-empty">Sin elementos. <a href="${escapeHtml(
            section.emptyCtaDeepLink,
          )}">Configurar</a></p>`,
        );
      } else if (tree.audience !== "guest") {
        out.push('<p class="gt-empty">Sin elementos.</p>');
      }
      out.push("</section>");
      continue;
    }
    out.push("<ul>");
    for (const item of renderable) {
      renderItem(item, out);
    }
    out.push("</ul></section>");
  }
  out.push("</article>");
  return out.join("");
}
