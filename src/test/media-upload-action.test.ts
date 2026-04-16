import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ─────────────────────────────────────────

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    mediaAsset: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

// ── Mock storage service ────────────────────────────────

const mockGetUploadUrl = vi.fn();
const mockGetDownloadUrl = vi.fn();
const mockDeleteObject = vi.fn();
const mockHeadObject = vi.fn();

vi.mock("@/lib/services/media-storage.service", () => ({
  ALLOWED_MEDIA: {
    "image/jpeg": 10 * 1024 * 1024,
    "image/png": 10 * 1024 * 1024,
    "image/webp": 10 * 1024 * 1024,
    "image/avif": 10 * 1024 * 1024,
    "image/gif": 10 * 1024 * 1024,
    "video/mp4": 100 * 1024 * 1024,
  },
  buildStorageKey: (p: string, a: string, f: string) => `${p}/${a}/${f}`,
  getUploadUrl: (...args: unknown[]) => mockGetUploadUrl(...args),
  getDownloadUrl: (...args: unknown[]) => mockGetDownloadUrl(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  headObject: (...args: unknown[]) => mockHeadObject(...args),
}));

// ── Mock next/cache ─────────────────────────────────────

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Mock sharp + blurhash (used by generateBlurhash) ────

vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    ensureAlpha: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue({
      data: Buffer.alloc(32 * 32 * 4),
      info: { width: 32, height: 32 },
    }),
  }),
}));

vi.mock("blurhash", () => ({
  encode: vi.fn().mockReturnValue("LEHV6nWB2yk8pyo0adR*.7kCMdnj"),
}));

import {
  requestUploadAction,
  confirmUploadAction,
  deleteMediaAction,
  getMediaDownloadUrlAction,
} from "@/lib/actions/media.actions";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockFindUnique.mockReset();
  mockDelete.mockReset();
  mockGetUploadUrl.mockReset();
  mockGetDownloadUrl.mockReset();
  mockDeleteObject.mockReset();
  mockHeadObject.mockReset();
});

describe("requestUploadAction", () => {
  it("returns error for disallowed mimeType", async () => {
    const result = await requestUploadAction("p1", "doc.pdf", "application/pdf");
    expect(result.success).toBe(false);
    expect(result.error).toContain("no permitido");
  });

  it("creates asset and returns presigned URL for valid mimeType", async () => {
    mockCreate.mockResolvedValue({ id: "asset1" });
    mockUpdate.mockResolvedValue({});
    mockGetUploadUrl.mockResolvedValue("https://r2.example.com/put");

    const result = await requestUploadAction("p1", "photo.jpg", "image/jpeg");

    expect(result.success).toBe(true);
    expect(result.data?.uploadUrl).toBe("https://r2.example.com/put");
    expect(result.data?.assetId).toBe("asset1");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].data.mediaType).toBe("image");
    expect(mockCreate.mock.calls[0][0].data.status).toBe("pending");
  });

  it("sets mediaType to video for video/mp4", async () => {
    mockCreate.mockResolvedValue({ id: "asset2" });
    mockUpdate.mockResolvedValue({});
    mockGetUploadUrl.mockResolvedValue("https://r2.example.com/put");

    await requestUploadAction("p1", "clip.mp4", "video/mp4");

    expect(mockCreate.mock.calls[0][0].data.mediaType).toBe("video");
  });
});

describe("confirmUploadAction", () => {
  it("returns error if asset not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await confirmUploadAction("nonexistent");
    expect(result.success).toBe(false);
    expect(result.error).toContain("no encontrado");
  });

  it("returns error if asset is not pending", async () => {
    mockFindUnique.mockResolvedValue({
      id: "a1",
      storageKey: "p/a/f.jpg",
      status: "ready",
      mimeType: "image/jpeg",
      propertyId: "p1",
    });
    const result = await confirmUploadAction("a1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("inesperado");
  });

  it("returns error if file not in R2", async () => {
    mockFindUnique.mockResolvedValue({
      id: "a1",
      storageKey: "p/a/f.jpg",
      status: "pending",
      mimeType: "image/jpeg",
      propertyId: "p1",
    });
    mockHeadObject.mockResolvedValue(null);

    const result = await confirmUploadAction("a1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("no encontrado en storage");
  });

  it("deletes oversized files and returns error", async () => {
    mockFindUnique.mockResolvedValue({
      id: "a1",
      storageKey: "p/a/f.jpg",
      status: "pending",
      mimeType: "image/jpeg",
      propertyId: "p1",
    });
    mockHeadObject.mockResolvedValue({
      contentLength: 20 * 1024 * 1024, // 20MB > 10MB limit
      contentType: "image/jpeg",
    });

    const result = await confirmUploadAction("a1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("demasiado grande");
    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("confirms valid upload with blurhash for images", async () => {
    mockFindUnique.mockResolvedValue({
      id: "a1",
      storageKey: "p/a/f.jpg",
      status: "pending",
      mimeType: "image/jpeg",
      propertyId: "p1",
    });
    mockHeadObject.mockResolvedValue({
      contentLength: 500_000,
      contentType: "image/jpeg",
    });
    mockGetDownloadUrl.mockResolvedValue("https://r2.example.com/get");
    // Mock fetch to return a fake image buffer for blurhash generation
    mockFetch.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });

    const result = await confirmUploadAction("a1");
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData.status).toBe("ready");
    expect(updateData.sizeBytes).toBe(500_000);
    expect(updateData.blurhash).toBe("LEHV6nWB2yk8pyo0adR*.7kCMdnj");
  });

  it("skips blurhash for video", async () => {
    mockFindUnique.mockResolvedValue({
      id: "a2",
      storageKey: "p/a/clip.mp4",
      status: "pending",
      mimeType: "video/mp4",
      propertyId: "p1",
    });
    mockHeadObject.mockResolvedValue({
      contentLength: 5_000_000,
      contentType: "video/mp4",
    });

    const result = await confirmUploadAction("a2");
    expect(result.success).toBe(true);
    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData.blurhash).toBeNull();
  });
});

describe("deleteMediaAction", () => {
  it("returns error if asset not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await deleteMediaAction("nonexistent");
    expect(result.success).toBe(false);
  });

  it("deletes from R2 and DB", async () => {
    mockFindUnique.mockResolvedValue({
      id: "a1",
      storageKey: "p/a/f.jpg",
      propertyId: "p1",
    });
    mockDeleteObject.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue({});

    const result = await deleteMediaAction("a1");
    expect(result.success).toBe(true);
    expect(mockDeleteObject).toHaveBeenCalledWith("p/a/f.jpg");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "a1" } });
  });

  it("continues with DB delete even if R2 delete fails", async () => {
    mockFindUnique.mockResolvedValue({
      id: "a1",
      storageKey: "p/a/f.jpg",
      propertyId: "p1",
    });
    mockDeleteObject.mockRejectedValue(new Error("R2 down"));
    mockDelete.mockResolvedValue({});

    const result = await deleteMediaAction("a1");
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});

describe("getMediaDownloadUrlAction", () => {
  it("returns error if asset not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getMediaDownloadUrlAction("x");
    expect(result.success).toBe(false);
  });

  it("returns error if asset not ready", async () => {
    mockFindUnique.mockResolvedValue({ storageKey: "k", status: "pending" });
    const result = await getMediaDownloadUrlAction("a1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("no está listo");
  });

  it("returns presigned download URL for ready asset", async () => {
    mockFindUnique.mockResolvedValue({ storageKey: "p/a/f.jpg", status: "ready" });
    mockGetDownloadUrl.mockResolvedValue("https://r2.example.com/signed");

    const result = await getMediaDownloadUrlAction("a1");
    expect(result.success).toBe(true);
    expect(result.data?.url).toBe("https://r2.example.com/signed");
  });
});
