import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { generateSlug, ensurePropertySlug } from "@/lib/services/guide-slug.service";

const mockFindUnique = prisma.property.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.property.update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
});

describe("generateSlug", () => {
  it("returns a string of the expected length", () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(8);
  });

  it("respects custom length", () => {
    expect(generateSlug(12)).toHaveLength(12);
  });

  it("uses only base62 characters", () => {
    for (let i = 0; i < 50; i++) {
      const slug = generateSlug();
      expect(slug).toMatch(/^[0-9A-Za-z]+$/);
    }
  });

  it("generates unique slugs (probabilistic)", () => {
    const slugs = new Set(Array.from({ length: 100 }, () => generateSlug()));
    expect(slugs.size).toBe(100);
  });
});

describe("ensurePropertySlug", () => {
  it("returns existing slug if property already has one", async () => {
    mockFindUnique.mockResolvedValue({ publicSlug: "existing1" });
    const slug = await ensurePropertySlug("p1");
    expect(slug).toBe("existing1");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("generates and saves a new slug if none exists", async () => {
    mockFindUnique.mockResolvedValue({ publicSlug: null });
    mockUpdate.mockResolvedValue({ publicSlug: "newSlug1" });
    const slug = await ensurePropertySlug("p1");
    expect(slug).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("retries on P2002 unique collision", async () => {
    mockFindUnique.mockResolvedValue({ publicSlug: null });
    const p2002Error = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockUpdate
      .mockRejectedValueOnce(p2002Error)
      .mockRejectedValueOnce(p2002Error)
      .mockResolvedValueOnce({ publicSlug: "ok123456" });

    const slug = await ensurePropertySlug("p1");
    expect(slug).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  it("throws after MAX_RETRIES P2002 collisions", async () => {
    mockFindUnique.mockResolvedValue({ publicSlug: null });
    const p2002Error = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockUpdate.mockRejectedValue(p2002Error);

    await expect(ensurePropertySlug("p1")).rejects.toThrow(
      /Failed to generate unique slug/,
    );
    expect(mockUpdate).toHaveBeenCalledTimes(5);
  });

  it("re-throws non-P2002 errors immediately", async () => {
    mockFindUnique.mockResolvedValue({ publicSlug: null });
    const otherError = new Error("Connection lost");
    mockUpdate.mockRejectedValue(otherError);

    await expect(ensurePropertySlug("p1")).rejects.toThrow("Connection lost");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
