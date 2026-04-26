import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ImportPreviewResult } from "@/lib/imports/shared/types";

const auditCreate = vi.fn();
const auditFindFirst = vi.fn().mockResolvedValue(null);
const propertyUpdate = vi.fn().mockResolvedValue({});

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: (args: unknown) => auditCreate(args),
      findFirst: (args: unknown) => auditFindFirst(args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $executeRaw: vi.fn(),
        property: {
          findUnique: vi.fn(),
          update: (args: unknown) => propertyUpdate(args),
        },
        propertyAmenityInstance: {
          createMany: vi.fn(),
          deleteMany: vi.fn(),
        },
      };
      return fn(tx);
    },
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

function serverPreview(): ImportPreviewResult {
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

describe("applyImportDiff — applier ignores any client-sent diff and trusts server recompute", () => {
  beforeEach(() => {
    auditCreate.mockReset();
    auditCreate.mockResolvedValue({ id: "a1" });
    propertyUpdate.mockClear();
    previewMock.mockReset();
    previewMock.mockResolvedValue(serverPreview());
  });

  it("applied[] reflects server-computed `incoming`, not the original client payload value", async () => {
    const r = await applyImportDiff({
      propertyId: "prop_1",
      platform: "airbnb",
      payload: { bedrooms: 999, bathrooms: 999, person_capacity: 999 },
      resolutions: {},
      actorUserId: "u1",
    });
    expect(r.result).toBe("success");
    if (r.result !== "success") return;
    const bed = r.applied.find((m) => m.field === "scalar.bedroomsCount");
    expect(bed?.value).toBe(3);

    expect(propertyUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = propertyUpdate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.bedroomsCount).toBe(3);
  });

  it("applier never reads `current`/`incoming` from client input — even tampered fields go through server diff", async () => {
    const r = await applyImportDiff({
      propertyId: "prop_1",
      platform: "airbnb",
      payload: {},
      resolutions: { "scalar.bedroomsCount": "take_import" },
      actorUserId: "u1",
    });
    expect(r.result).toBe("success");
    if (r.result !== "success") return;
    expect(r.applied.find((m) => m.field === "scalar.bedroomsCount")?.value).toBe(3);
  });
});
