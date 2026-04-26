import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ImportPreviewResult } from "@/lib/imports/shared/types";

const auditCreate = vi.fn();
const auditFindFirst = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: (args: unknown) => auditCreate(args),
      findFirst: (args: unknown) => auditFindFirst(args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $executeRaw: vi.fn(),
        property: { findUnique: vi.fn(), update: vi.fn() },
        propertyAmenityInstance: {
          createMany: vi.fn(),
          deleteMany: vi.fn(),
        },
      }),
  },
}));

vi.mock("@/lib/imports/airbnb/serialize", () => ({
  previewAirbnbImport: vi.fn(),
}));
vi.mock("@/lib/imports/booking/serialize", () => ({
  previewBookingImport: vi.fn(),
}));

import { applyImportDiff } from "@/lib/imports/shared/import-applier.service";
import { previewAirbnbImport } from "@/lib/imports/airbnb/serialize";

const previewMock = vi.mocked(previewAirbnbImport);

function preview(): ImportPreviewResult {
  return {
    diff: {
      scalar: [
        {
          field: "bedroomsCount",
          current: null,
          incoming: 3,
          status: "fresh",
          suggestedAction: "take_import",
        },
      ],
      policies: [],
      presence: [],
      amenities: { add: [], remove: [], identicalCount: 0 },
      freeText: [],
      customs: [],
      meta: {
        generatedAt: "2026-04-26T00:00:00.000Z",
        payloadShape: "airbnb-v1",
        currentLocale: "es",
        incomingLocale: "es",
      },
    },
    warnings: [],
  };
}

describe("applyImportDiff — stale resolutions return 409-shaped result", () => {
  beforeEach(() => {
    auditCreate.mockReset();
    previewMock.mockReset();
    previewMock.mockResolvedValue(preview());
  });

  it("client resolution for a field absent from server-recomputed diff → result:stale with diff + missingFields", async () => {
    const r = await applyImportDiff({
      propertyId: "prop_1",
      platform: "airbnb",
      payload: {},
      resolutions: {
        "amenities.add.am.wifi": "take_import",
      },
      actorUserId: "u1",
    });

    expect(r.result).toBe("stale");
    if (r.result !== "stale") return;
    expect(r.missingFields).toContain("amenities.add.am.wifi");
    expect(r.diff.scalar.length).toBe(1);
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
