import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the S3 client module
const mockSend = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
  class FakeS3Client {
    send = mockSend;
  }
  return {
    S3Client: FakeS3Client,
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: "PutObject" })),
    GetObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: "GetObject" })),
    DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: "DeleteObject" })),
    HeadObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: "HeadObject" })),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

import {
  buildStorageKey,
  getUploadUrl,
  getDownloadUrl,
  deleteObject,
  headObject,
  ALLOWED_MEDIA,
} from "@/lib/services/media-storage.service";

beforeEach(() => {
  mockSend.mockReset();
  mockGetSignedUrl.mockReset();
  // Set env vars so getS3Client() doesn't throw
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_ACCESS_KEY_ID = "test-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.R2_BUCKET = "test-bucket";
});

describe("buildStorageKey", () => {
  it("builds key from propertyId/assetId/fileName", () => {
    const key = buildStorageKey("prop1", "asset1", "photo.jpg");
    expect(key).toBe("prop1/asset1/photo.jpg");
  });

  it("sanitises special characters in fileName", () => {
    const key = buildStorageKey("p1", "a1", "café photo (1).jpg");
    expect(key).toBe("p1/a1/cafe_photo__1_.jpg");
  });

  it("strips accents", () => {
    const key = buildStorageKey("p1", "a1", "façade_résumé.png");
    expect(key).toBe("p1/a1/facade_resume.png");
  });

  it("truncates to 200 chars", () => {
    const longName = "a".repeat(250) + ".jpg";
    const key = buildStorageKey("p", "a", longName);
    const fileName = key.split("/")[2];
    expect(fileName.length).toBeLessThanOrEqual(200);
  });
});

describe("ALLOWED_MEDIA", () => {
  it("allows image types with 10MB limit", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]) {
      expect(ALLOWED_MEDIA[mime]).toBe(10 * 1024 * 1024);
    }
  });

  it("allows video/mp4 with 100MB limit", () => {
    expect(ALLOWED_MEDIA["video/mp4"]).toBe(100 * 1024 * 1024);
  });

  it("does not allow arbitrary types", () => {
    expect(ALLOWED_MEDIA["application/pdf"]).toBeUndefined();
    expect(ALLOWED_MEDIA["text/html"]).toBeUndefined();
  });
});

describe("getUploadUrl", () => {
  it("returns a presigned URL from the S3 SDK", async () => {
    mockGetSignedUrl.mockResolvedValue("https://r2.example.com/signed-put");

    const url = await getUploadUrl("p/a/file.jpg", "image/jpeg");

    expect(url).toBe("https://r2.example.com/signed-put");
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    const [, command, options] = mockGetSignedUrl.mock.calls[0];
    expect(command).toMatchObject({
      _type: "PutObject",
      Key: "p/a/file.jpg",
      ContentType: "image/jpeg",
    });
    expect(options.expiresIn).toBe(15 * 60);
  });
});

describe("getDownloadUrl", () => {
  it("returns a presigned download URL", async () => {
    mockGetSignedUrl.mockResolvedValue("https://r2.example.com/signed-get");

    const url = await getDownloadUrl("p/a/file.jpg");

    expect(url).toBe("https://r2.example.com/signed-get");
    const [, command, options] = mockGetSignedUrl.mock.calls[0];
    expect(command).toMatchObject({ _type: "GetObject", Key: "p/a/file.jpg" });
    expect(options.expiresIn).toBe(60 * 60);
  });
});

describe("deleteObject", () => {
  it("sends a delete command", async () => {
    mockSend.mockResolvedValue({});
    await deleteObject("p/a/file.jpg");
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      _type: "DeleteObject",
      Key: "p/a/file.jpg",
    });
  });
});

describe("headObject", () => {
  it("returns content info when object exists", async () => {
    mockSend.mockResolvedValue({
      ContentLength: 123456,
      ContentType: "image/jpeg",
    });

    const result = await headObject("p/a/file.jpg");

    expect(result).toEqual({
      contentLength: 123456,
      contentType: "image/jpeg",
    });
  });

  it("returns null when object not found", async () => {
    const notFound = Object.assign(new Error("Not Found"), { name: "NotFound" });
    mockSend.mockRejectedValue(notFound);

    const result = await headObject("p/a/missing.jpg");
    expect(result).toBeNull();
  });

  it("re-throws non-NotFound errors", async () => {
    const networkError = new Error("Network failure");
    mockSend.mockRejectedValue(networkError);

    await expect(headObject("p/a/file.jpg")).rejects.toThrow("Network failure");
  });
});
