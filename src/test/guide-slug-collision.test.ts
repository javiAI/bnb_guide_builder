import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        property: {
          findUnique: (...args: unknown[]) => mockFindUnique(...args),
          updateMany: (...args: unknown[]) => mockUpdateMany(...args),
        },
      }),
  },
}));

import { generateSlug, ensurePropertySlug } from "@/lib/services/guide-slug.service";

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdateMany.mockReset();
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
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("generates and saves a new slug if none exists", async () => {
    mockFindUnique.mockResolvedValue({ publicSlug: null });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    const slug = await ensurePropertySlug("p1");
    expect(slug).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("returns existing slug if another caller won the race", async () => {
    // First call: no slug yet
    mockFindUnique
      .mockResolvedValueOnce({ publicSlug: null })
      // Inside transaction: another caller already set the slug
      .mockResolvedValueOnce({ publicSlug: "raceWin1" });
    mockUpdateMany.mockResolvedValue({ count: 0 }); // our write was a no-op

    const slug = await ensurePropertySlug("p1");
    expect(slug).toBe("raceWin1");
  });

  it("retries on P2002 unique collision", async () => {
    mockFindUnique.mockResolvedValue({ publicSlug: null });
    const p2002Error = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockUpdateMany
      .mockRejectedValueOnce(p2002Error)
      .mockRejectedValueOnce(p2002Error)
      .mockResolvedValueOnce({ count: 1 });

    const slug = await ensurePropertySlug("p1");
    expect(slug).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(mockUpdateMany).toHaveBeenCalledTimes(3);
  });

  it("throws after MAX_RETRIES P2002 collisions", async () => {
    mockFindUnique.mockResolvedValue({ publicSlug: null });
    const p2002Error = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockUpdateMany.mockRejectedValue(p2002Error);

    await expect(ensurePropertySlug("p1")).rejects.toThrow(
      /Failed to generate unique slug/,
    );
    expect(mockUpdateMany).toHaveBeenCalledTimes(5);
  });

  it("re-throws non-P2002 errors immediately", async () => {
    mockFindUnique.mockResolvedValue({ publicSlug: null });
    const otherError = new Error("Connection lost");
    mockUpdateMany.mockRejectedValue(otherError);

    await expect(ensurePropertySlug("p1")).rejects.toThrow("Connection lost");
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });
});
