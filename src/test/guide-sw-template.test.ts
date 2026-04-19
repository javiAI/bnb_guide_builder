import { describe, it, expect } from "vitest";
import {
  SW_TEMPLATE,
  SW_TEMPLATE_PLACEHOLDERS,
  renderSwTemplate,
} from "@/lib/server/sw-template";

describe("SW template", () => {
  it("substitutes both placeholders", () => {
    const out = renderSwTemplate({ slug: "casa-claudia", version: "abc123def456" });
    expect(out).not.toContain(SW_TEMPLATE_PLACEHOLDERS.slug);
    expect(out).not.toContain(SW_TEMPLATE_PLACEHOLDERS.version);
  });

  it("substitutes slug and version into JS string literals", () => {
    const out = renderSwTemplate({ slug: "casa-claudia", version: "abc123def456" });
    expect(out).toContain('SLUG = "casa-claudia"');
    expect(out).toContain('VERSION = "abc123def456"');
  });

  it("preserves the cache-name template that scopes per slug + version", () => {
    const out = renderSwTemplate({ slug: "casa-claudia", version: "v" });
    expect(out).toContain('"guide-" + SLUG + "-tier1-" + VERSION');
    expect(out).toContain('"guide-" + SLUG + "-tier2-" + VERSION');
    expect(out).toContain('"guide-" + SLUG + "-tier3-" + VERSION');
  });

  it("scopes the SW path prefix to the slug at runtime", () => {
    const out = renderSwTemplate({ slug: "casa-claudia", version: "v" });
    expect(out).toContain('"/g/" + SLUG + "/"');
  });

  it("encodes the offline fallback path in precache", () => {
    expect(SW_TEMPLATE).toContain('SCOPE_PREFIX + "offline"');
    expect(SW_TEMPLATE).toContain('SCOPE_PREFIX + "manifest.webmanifest"');
  });

  it("rejects empty slug or version", () => {
    expect(() => renderSwTemplate({ slug: "", version: "v1" })).toThrow(/slug/);
    expect(() => renderSwTemplate({ slug: "x", version: "" })).toThrow(/version/);
  });
});
