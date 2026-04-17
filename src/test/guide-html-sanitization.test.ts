import { describe, it, expect } from "vitest";
import { renderHtml, escapeHtml } from "@/lib/renderers/guide-html";
import type { GuideTree } from "@/lib/types/guide-tree";

function makeTree(overrides: Partial<GuideTree> = {}): GuideTree {
  return {
    propertyId: "p1",
    audience: "guest",
    generatedAt: "2026-04-16T12:00:00.000Z",
    sections: [
      {
        id: "gs.arrival",
        label: "Llegada",
        order: 1,
        resolverKey: "arrival",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "guest",
        items: [],
      },
    ],
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes all 5 special characters", () => {
    expect(escapeHtml(`<script>alert("x&y")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml(`it's`)).toBe("it&#39;s");
  });
});

describe("renderHtml — sanitization", () => {
  it("escapes <script> tags in item labels and values", () => {
    const tree = makeTree({
      sections: [
        {
          id: "gs.emergency",
          label: "Ayuda y emergencias",
          order: 5,
          resolverKey: "emergency",
          sortBy: "explicit_order",
          emptyCtaDeepLink: null,
          maxVisibility: "internal",
          items: [
            {
              id: "c1",
              taxonomyKey: null,
              label: "<script>alert(1)</script>",
              value: `evil"onmouseover=alert(1)`,
              visibility: "guest",
              deprecated: false,
              warnings: [],
              fields: [],
              media: [],
              children: [],
            },
          ],
        },
      ],
    });
    const html = renderHtml(tree);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("evil&quot;onmouseover=alert(1)");
  });

  it("escapes event-handler-like content in fields", () => {
    const tree = makeTree({
      sections: [
        {
          id: "gs.spaces",
          label: "Espacios",
          order: 2,
          resolverKey: "spaces",
          sortBy: "explicit_order",
          emptyCtaDeepLink: null,
          maxVisibility: "internal",
          items: [
            {
              id: "s1",
              taxonomyKey: "sp.bedroom",
              label: "Dormitorio",
              value: null,
              visibility: "guest",
              deprecated: false,
              warnings: [],
              fields: [
                { label: "Notas", value: `<img src=x onerror="alert(1)">`, visibility: "guest" },
              ],
              media: [],
              children: [],
            },
          ],
        },
      ],
    });
    const html = renderHtml(tree);
    expect(html).not.toContain("<img src=x onerror=");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("rejects unsafe media URLs (javascript:, vbscript:, file:)", () => {
    const tree = makeTree({
      sections: [
        {
          id: "gs.spaces",
          label: "Espacios",
          order: 2,
          resolverKey: "spaces",
          sortBy: "explicit_order",
          emptyCtaDeepLink: null,
          maxVisibility: "internal",
          items: [
            {
              id: "s1",
              taxonomyKey: null,
              label: "Sala",
              value: null,
              visibility: "guest",
              deprecated: false,
              warnings: [],
              fields: [],
              media: [
                {
                  assetId: "a1",
                  variants: {
                    thumb: "javascript:alert(1)",
                    md: "javascript:alert(1)",
                    full: "javascript:alert(1)",
                  },
                  mimeType: "image/png",
                  alt: "evil",
                  caption: "evil",
                },
                {
                  assetId: "a2",
                  variants: {
                    thumb: "file:///etc/passwd",
                    md: "file:///etc/passwd",
                    full: "file:///etc/passwd",
                  },
                  mimeType: "image/png",
                  alt: "leak",
                  caption: "leak",
                },
                {
                  assetId: "a3",
                  variants: {
                    thumb: "https://cdn.example.com/ok.png",
                    md: "https://cdn.example.com/ok.png",
                    full: "https://cdn.example.com/ok.png",
                  },
                  mimeType: "image/png",
                  alt: "safe",
                  caption: "safe",
                },
              ],
              children: [],
            },
          ],
        },
      ],
    });
    const html = renderHtml(tree);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("file:///");
    expect(html).toContain("https://cdn.example.com/ok.png");
  });

  it("escapes empty-state CTA href", () => {
    // CTA deep-links are a host-panel affordance and only render for
    // non-guest audiences (rama 10F). Use `internal` so the CTA path is
    // exercised.
    const tree = makeTree({
      audience: "internal",
      sections: [
        {
          id: "gs.arrival",
          label: "Llegada",
          order: 1,
          resolverKey: "arrival",
          sortBy: "explicit_order",
          emptyCtaDeepLink: `/host/p1?x=1&y="<script>"`,
          maxVisibility: "internal",
          items: [],
        },
      ],
    });
    const html = renderHtml(tree);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;&lt;script&gt;&quot;");
  });
});
