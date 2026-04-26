import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ImportPreviewResult } from "@/lib/imports/shared/types";

const auditCreate = vi.fn();
const auditFindFirst = vi.fn().mockResolvedValue(null);
const txExecuteRaw = vi.fn();
const propertyFindUnique = vi.fn();
const propertyUpdate = vi.fn();
const amenityCreateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: (args: unknown) => auditCreate(args),
      findFirst: (args: unknown) => auditFindFirst(args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $executeRaw: (...args: unknown[]) => txExecuteRaw(...args),
        property: {
          findUnique: (args: unknown) => propertyFindUnique(args),
          update: (args: unknown) => propertyUpdate(args),
        },
        propertyAmenityInstance: {
          createMany: (args: unknown) => amenityCreateMany(args),
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
      amenities: {
        add: [
          { taxonomyId: "am.wifi", sourceExternalId: null, sourceLabelEn: null },
        ],
        remove: [],
        identicalCount: 0,
      },
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

describe("applyImportDiff — atomicity", () => {
  beforeEach(() => {
    auditCreate.mockReset();
    propertyUpdate.mockReset();
    amenityCreateMany.mockReset();
    txExecuteRaw.mockReset();
    propertyFindUnique.mockReset();
    previewMock.mockReset();
  });

  it("mid-tx failure → result:failed + audit row with failed:true", async () => {
    previewMock.mockResolvedValue(preview());
    propertyUpdate.mockResolvedValueOnce({});
    amenityCreateMany.mockRejectedValueOnce(new Error("simulated DB failure"));
    auditCreate.mockResolvedValue({ id: "a1" });

    const r = await applyImportDiff({
      propertyId: "prop_1",
      platform: "airbnb",
      payload: {},
      resolutions: {},
      actorUserId: "u1",
    });

    expect(r.result).toBe("failed");
    if (r.result !== "failed") return;
    expect(r.error).toContain("simulated DB failure");

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const args = auditCreate.mock.calls[0][0] as {
      data: { diffJson: { failed?: boolean; error?: string } };
    };
    expect(args.data.diffJson.failed).toBe(true);
    expect(args.data.diffJson.error).toContain("simulated DB failure");
  });
});
