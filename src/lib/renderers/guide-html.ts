/**
 * HTML renderer for `GuideTree`. Every string that comes from DB (labels,
 * values, captions, urls) is escaped — the renderer itself is the only source
 * of HTML structure. No `dangerouslySetInnerHTML`-shaped output ever reaches
 * the caller. Media URLs are validated to http/https/data to prevent
 * `javascript:` href/src injection.
 */

import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";

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
  return /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp|avif);)/i.test(url);
}

function renderItem(item: GuideItem, out: string[]): void {
  const deprecated = item.deprecated
    ? ' <em class="gt-deprecated">(deprecated)</em>'
    : "";
  const value = item.value ? `: ${escapeHtml(item.value)}` : "";
  out.push(
    `<li><strong>${escapeHtml(item.label)}</strong>${deprecated}${value}`,
  );
  const hasDetails =
    item.fields.length > 0 || item.media.length > 0 || item.children.length > 0;
  if (hasDetails) {
    out.push("<ul>");
    for (const f of item.fields) {
      out.push(
        `<li>${escapeHtml(f.label)}: ${escapeHtml(f.value)}</li>`,
      );
    }
    for (const m of item.media) {
      if (!isSafeUrl(m.url)) continue;
      const caption = escapeHtml(m.caption ?? "");
      const url = escapeHtml(m.url);
      out.push(`<li><img src="${url}" alt="${caption}" /></li>`);
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
  out.push(
    `<header><h1>${escapeHtml(tree.propertyId)} — audiencia: ${escapeHtml(
      tree.audience,
    )}</h1><p class="gt-generated">Generado: ${escapeHtml(
      tree.generatedAt,
    )}</p></header>`,
  );
  for (const section of tree.sections) {
    out.push(`<section><h2>${escapeHtml(section.label)}</h2>`);
    if (section.items.length === 0) {
      if (section.emptyCtaDeepLink) {
        out.push(
          `<p class="gt-empty">Sin elementos. <a href="${escapeHtml(
            section.emptyCtaDeepLink,
          )}">Configurar</a></p>`,
        );
      } else {
        out.push('<p class="gt-empty">Sin elementos.</p>');
      }
      out.push("</section>");
      continue;
    }
    out.push("<ul>");
    for (const item of section.items) {
      renderItem(item, out);
    }
    out.push("</ul></section>");
  }
  out.push("</article>");
  return out.join("");
}
