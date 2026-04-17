/**
 * Cache header semantics. Stable contentHash → immutable 1y + strong ETag.
 * Missing contentHash → weak revalidating cache.
 */
import { describe, it, expect } from "vitest";
import {
  assetHashPrefix,
  buildCacheHeaders,
  buildMediaProxyUrl,
  parseAssetIdHash,
} from "@/lib/services/media-proxy.service";

describe("buildCacheHeaders", () => {
  it("emits strong immutable cache + variant-scoped ETag when contentHash present", () => {
    const h = buildCacheHeaders("abcdef1234567890", "thumb", "image/jpeg", 12345);
    expect(h.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(h.get("ETag")).toBe('"abcdef1234567890-thumb"');
    expect(h.get("Content-Type")).toBe("image/jpeg");
    expect(h.get("Content-Length")).toBe("12345");
  });

  it("ETag differs across variants for the same contentHash", () => {
    const hThumb = buildCacheHeaders("hash1", "thumb", "image/jpeg", 10);
    const hMd = buildCacheHeaders("hash1", "md", "image/jpeg", 20);
    expect(hThumb.get("ETag")).not.toBe(hMd.get("ETag"));
  });

  it("emits weak revalidating cache when contentHash null", () => {
    const h = buildCacheHeaders(null, "full", "image/png", null);
    expect(h.get("Cache-Control")).toBe("public, max-age=3600, must-revalidate");
    expect(h.get("ETag")).toBeNull();
    expect(h.get("Content-Length")).toBeNull();
  });
});

describe("assetHashPrefix + URL builder", () => {
  it("uses contentHash prefix when available", () => {
    expect(assetHashPrefix("asset1cuid", "abcdef1234567890")).toBe("abcdef12");
  });

  it("falls back to assetId prefix when contentHash missing", () => {
    expect(assetHashPrefix("assetfoobar", null)).toBe("assetfoo");
  });

  it("buildMediaProxyUrl embeds hash in path", () => {
    const url = buildMediaProxyUrl("mi-casa", "assetXYZ123", "deadbeefcafebabe", "thumb");
    expect(url).toBe("/g/mi-casa/media/assetXYZ123-deadbeef/thumb");
  });

  it("URL is always relative — never absolute R2 URL", () => {
    const url = buildMediaProxyUrl("slug", "id1234567", "hash1234", "full");
    expect(url.startsWith("/g/")).toBe(true);
    expect(url).not.toContain("r2.cloudflarestorage.com");
    expect(url).not.toContain("X-Amz");
  });
});

describe("parseAssetIdHash", () => {
  it("splits on last dash", () => {
    expect(parseAssetIdHash("asset1-abcdef12")).toEqual({
      assetId: "asset1",
      hashPrefix: "abcdef12",
    });
  });

  it("rejects missing dash", () => {
    expect(parseAssetIdHash("asset1abcdef12")).toBeNull();
  });

  it("rejects leading/trailing dash", () => {
    expect(parseAssetIdHash("-abcdef12")).toBeNull();
    expect(parseAssetIdHash("asset1-")).toBeNull();
  });

  it("rejects non-alphanumeric components", () => {
    expect(parseAssetIdHash("asset..1-abcdef12")).toBeNull();
    expect(parseAssetIdHash("asset1-abc/def")).toBeNull();
  });
});
