/**
 * Route-level tests for `/g/[slug]/media/[assetIdHash]/[variant]`.
 * Exercises variant parsing, auth, 200/404/304/206 paths.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { mediaAsset: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}));

const mockSend = vi.fn();
vi.mock("@aws-sdk/client-s3", () => {
  class FakeS3Client {
    send = mockSend;
  }
  return {
    S3Client: FakeS3Client,
    GetObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: "GetObject" })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: "PutObject" })),
    DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: "DeleteObject" })),
    HeadObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: "HeadObject" })),
  };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));

import { GET } from "@/app/g/[slug]/media/[assetIdHash]/[variant]/route";

const BUCKET = "test-bucket";

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset1cuid",
    propertyId: "p1",
    storageKey: "p1/asset1cuid/photo.jpg",
    mimeType: "image/jpeg",
    contentHash: "abcdef1234567890",
    status: "ready",
    property: {
      publicSlug: "mi-casa",
      _count: { guideVersions: 1 },
    },
    ...overrides,
  };
}

function fakeWebStream() {
  return new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array([1, 2, 3]));
      c.close();
    },
  });
}

function fakeBody(range = false) {
  return {
    transformToWebStream: () => fakeWebStream(),
    ContentLength: 3,
    ContentType: "image/jpeg",
    ...(range ? { ContentRange: "bytes 0-2/3" } : {}),
  };
}

beforeEach(() => {
  mockFindUnique.mockReset();
  mockSend.mockReset();
  process.env.R2_ACCOUNT_ID = "acc";
  process.env.R2_ACCESS_KEY_ID = "k";
  process.env.R2_SECRET_ACCESS_KEY = "s";
  process.env.R2_BUCKET = BUCKET;
});

function call(slug: string, assetIdHash: string, variant: string, headers: Record<string, string> = {}) {
  const req = new Request(`http://localhost/g/${slug}/media/${assetIdHash}/${variant}`, { headers });
  return GET(req, {
    params: Promise.resolve({ slug, assetIdHash, variant }),
  });
}

describe("media proxy route — 200 path", () => {
  it("serves valid variant with matching hash", async () => {
    mockFindUnique.mockResolvedValue(makeAsset());
    mockSend.mockResolvedValue({ Body: fakeBody(), ContentLength: 3, ContentType: "image/jpeg" });

    const res = await call("mi-casa", "asset1cuid-abcdef12", "thumb");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("ETag")).toBe('"abcdef1234567890-thumb"');
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
  });

  it("accepts full/md/thumb variants", async () => {
    for (const variant of ["full", "md", "thumb"]) {
      mockFindUnique.mockResolvedValue(makeAsset());
      mockSend.mockResolvedValue({ Body: fakeBody(), ContentLength: 3, ContentType: "image/jpeg" });
      const res = await call("mi-casa", "asset1cuid-abcdef12", variant);
      expect(res.status).toBe(200);
    }
  });
});

describe("media proxy route — 404 paths", () => {
  it("rejects unknown variant", async () => {
    const res = await call("mi-casa", "asset1cuid-abcdef12", "xlarge");
    expect(res.status).toBe(404);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("rejects malformed assetIdHash (no dash)", async () => {
    const res = await call("mi-casa", "asset1cuidabcdef12", "thumb");
    expect(res.status).toBe(404);
  });

  it("rejects non-existent asset", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await call("mi-casa", "missing-abcdef12", "thumb");
    expect(res.status).toBe(404);
  });

  it("rejects slug mismatch", async () => {
    mockFindUnique.mockResolvedValue(makeAsset());
    const res = await call("otra-casa", "asset1cuid-abcdef12", "thumb");
    expect(res.status).toBe(404);
  });

  it("rejects hash mismatch when contentHash is set", async () => {
    mockFindUnique.mockResolvedValue(makeAsset());
    const res = await call("mi-casa", "asset1cuid-deadbeef", "thumb");
    expect(res.status).toBe(404);
  });

  it("rejects when property has no publicSlug", async () => {
    mockFindUnique.mockResolvedValue(
      makeAsset({ property: { publicSlug: null, _count: { guideVersions: 1 } } }),
    );
    const res = await call("mi-casa", "asset1cuid-abcdef12", "thumb");
    expect(res.status).toBe(404);
  });

  it("rejects when no published GuideVersion", async () => {
    mockFindUnique.mockResolvedValue(
      makeAsset({ property: { publicSlug: "mi-casa", _count: { guideVersions: 0 } } }),
    );
    const res = await call("mi-casa", "asset1cuid-abcdef12", "thumb");
    expect(res.status).toBe(404);
  });
});

describe("media proxy route — 304 conditional", () => {
  it("returns 304 when If-None-Match matches contentHash+variant", async () => {
    mockFindUnique.mockResolvedValue(makeAsset());
    const res = await call("mi-casa", "asset1cuid-abcdef12", "thumb", {
      "if-none-match": '"abcdef1234567890-thumb"',
    });
    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toBe('"abcdef1234567890-thumb"');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does NOT return 304 when variant differs (cross-variant cache poisoning guard)", async () => {
    mockFindUnique.mockResolvedValue(makeAsset());
    mockSend.mockResolvedValue({ Body: fakeBody(), ContentLength: 3, ContentType: "image/jpeg" });
    const res = await call("mi-casa", "asset1cuid-abcdef12", "md", {
      "if-none-match": '"abcdef1234567890-thumb"',
    });
    expect(res.status).toBe(200);
  });
});

describe("media proxy route — 206 Range", () => {
  it("propagates 206 when S3 returns ContentRange", async () => {
    mockFindUnique.mockResolvedValue(
      makeAsset({ mimeType: "video/mp4", storageKey: "p1/asset1cuid/video.mp4" }),
    );
    mockSend.mockResolvedValue({
      Body: fakeBody(true),
      ContentLength: 3,
      ContentType: "video/mp4",
      ContentRange: "bytes 0-2/3",
    });

    const res = await call("mi-casa", "asset1cuid-abcdef12", "full", { range: "bytes=0-2" });

    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-2/3");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
  });
});

describe("media proxy route — no contentHash fallback", () => {
  it("weak cache headers + accepts any hash prefix when contentHash null", async () => {
    mockFindUnique.mockResolvedValue(makeAsset({ contentHash: null }));
    mockSend.mockResolvedValue({ Body: fakeBody(), ContentLength: 3, ContentType: "image/jpeg" });

    const res = await call("mi-casa", "asset1cuid-zzzzzzzz", "thumb");

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600, must-revalidate");
  });
});
