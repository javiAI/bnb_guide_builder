/**
 * Renderer-level invariants for the new GuideMedia shape (Rama 10C):
 *   1. Markdown uses `m.variants.md` (not thumb or full) + `m.alt`.
 *   2. Captions render as a trailing italic suffix.
 *   3. Inline media is capped at 3 images per item.
 *   4. HTML renderer emits `<figure><img alt loading="lazy" /><figcaption/>`.
 *   5. Relative `/g/<slug>/media/...` URLs are accepted by both renderers.
 */
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/lib/renderers/guide-markdown";
import { renderHtml } from "@/lib/renderers/guide-html";
import type { GuideItem, GuideMedia, GuideTree } from "@/lib/types/guide-tree";

function mkMedia(id: string, alt: string, caption?: string): GuideMedia {
  return {
    assetId: id,
    variants: {
      thumb: `/g/casa/media/${id}-hash1234/thumb`,
      md: `/g/casa/media/${id}-hash1234/md`,
      full: `/g/casa/media/${id}-hash1234/full`,
    },
    mimeType: "image/jpeg",
    alt,
    ...(caption ? { caption } : {}),
  };
}

function mkItem(media: GuideMedia[]): GuideItem {
  return {
    id: "s1",
    taxonomyKey: "sp.bedroom",
    label: "Dormitorio",
    value: null,
    visibility: "guest",
    deprecated: false,
    warnings: [],
    fields: [],
    media,
    children: [],
  };
}

function mkTree(items: GuideItem[]): GuideTree {
  return {
    propertyId: "p1",
    audience: "guest",
    generatedAt: "2026-04-17T00:00:00.000Z",
    sections: [
      {
        id: "gs.spaces",
        label: "Espacios",
        order: 2,
        resolverKey: "spaces",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "guest",
        items,
      },
    ],
  };
}

describe("renderMarkdown — media (10C)", () => {
  it("renders the `md` variant URL and `alt` as markdown image", () => {
    const md = renderMarkdown(
      mkTree([mkItem([mkMedia("asset1", "Vista del salón")])]),
    );
    expect(md).toContain("![Vista del salón](/g/casa/media/asset1-hash1234/md)");
    // Never the thumb or full variant inline.
    expect(md).not.toContain("/thumb");
    expect(md).not.toContain("/full");
  });

  it("appends caption as italic suffix after the image link", () => {
    const md = renderMarkdown(
      mkTree([mkItem([mkMedia("asset1", "Vista", "Al atardecer")])]),
    );
    expect(md).toMatch(/!\[Vista\]\([^)]+\) \*Al atardecer\*/);
  });

  it("omits caption suffix when caption is empty", () => {
    const md = renderMarkdown(mkTree([mkItem([mkMedia("asset1", "Vista")])]));
    const line = md.split("\n").find((l) => l.includes("![Vista]"))!;
    expect(line.endsWith(")")).toBe(true);
    expect(line).not.toContain("*");
  });

  it("caps inline media at 3 per item", () => {
    const media = [
      mkMedia("a1", "A1"),
      mkMedia("a2", "A2"),
      mkMedia("a3", "A3"),
      mkMedia("a4", "A4"),
      mkMedia("a5", "A5"),
    ];
    const md = renderMarkdown(mkTree([mkItem(media)]));
    expect(md).toContain("![A1]");
    expect(md).toContain("![A2]");
    expect(md).toContain("![A3]");
    expect(md).not.toContain("![A4]");
    expect(md).not.toContain("![A5]");
  });

  it("skips unsafe URL schemes (data:, javascript:) but keeps relative /g/", () => {
    const unsafe: GuideMedia = {
      assetId: "bad",
      variants: {
        thumb: "javascript:alert(1)",
        md: "javascript:alert(1)",
        full: "javascript:alert(1)",
      },
      mimeType: "image/png",
      alt: "evil",
    };
    const md = renderMarkdown(mkTree([mkItem([unsafe, mkMedia("ok", "Ok")])]));
    expect(md).not.toContain("javascript:");
    expect(md).toContain("![Ok]");
  });
});

describe("renderHtml — media (10C)", () => {
  it("emits <figure><img src alt loading=\"lazy\" /><figcaption/> for media with caption", () => {
    const html = renderHtml(
      mkTree([mkItem([mkMedia("asset1", "Alt texto", "Leyenda")])]),
    );
    expect(html).toContain("<figure>");
    expect(html).toContain(
      '<img src="/g/casa/media/asset1-hash1234/md" alt="Alt texto" loading="lazy" />',
    );
    expect(html).toContain("<figcaption>Leyenda</figcaption>");
    expect(html).toContain("</figure>");
  });

  it("omits figcaption when caption is missing", () => {
    const html = renderHtml(mkTree([mkItem([mkMedia("asset1", "Alt")])]));
    expect(html).toContain("<figure>");
    expect(html).not.toContain("<figcaption>");
  });

  it("caps inline media at 3 per item", () => {
    const media = [
      mkMedia("a1", "A1"),
      mkMedia("a2", "A2"),
      mkMedia("a3", "A3"),
      mkMedia("a4", "A4"),
    ];
    const html = renderHtml(mkTree([mkItem(media)]));
    const figureCount = (html.match(/<figure>/g) ?? []).length;
    expect(figureCount).toBe(3);
  });

  it("accepts relative /g/<slug>/media/ paths without flagging them unsafe", () => {
    const html = renderHtml(mkTree([mkItem([mkMedia("ok", "Alt")])]));
    expect(html).toContain('src="/g/casa/media/ok-hash1234/md"');
  });
});
