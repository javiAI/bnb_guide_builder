import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ImportPreviewResult } from "@/lib/imports/shared/types";

const auditCreate = vi.fn();
const auditFindFirst = vi.fn();
const propertyUpdate = vi.fn();
const amenityCreateMany = vi.fn();
const amenityDeleteMany = vi.fn();
const txExecuteRaw = vi.fn();

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
          findUnique: vi.fn(),
          update: (args: unknown) => propertyUpdate(args),
        },
        propertyAmenityInstance: {
          createMany: (args: unknown) => amenityCreateMany(args),
          deleteMany: (args: unknown) => amenityDeleteMany(args),
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

describe("applyImportDiff — idempotence by fingerprint", () => {
  beforeEach(() => {
    auditCreate.mockReset();
    auditFindFirst.mockReset();
    propertyUpdate.mockReset();
    amenityCreateMany.mockReset();
    amenityDeleteMany.mockReset();
    txExecuteRaw.mockReset();
    previewMock.mockReset();
  });

  it("first call mutates + audits; second call with same payload+resolutions → noop", async () => {
    previewMock.mockResolvedValue(preview());
    auditCreate.mockResolvedValue({ id: "a1" });

    auditFindFirst.mockResolvedValueOnce(null);
    const r1 = await applyImportDiff({
      propertyId: "prop_1",
      platform: "airbnb",
      payload: { x: 1 },
      resolutions: {},
      actorUserId: "u1",
    });
    expect(r1.result).toBe("success");
    expect(propertyUpdate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);

    auditFindFirst.mockResolvedValueOnce({ id: "a1" });
    const r2 = await applyImportDiff({
      propertyId: "prop_1",
      platform: "airbnb",
      payload: { x: 1 },
      resolutions: {},
      actorUserId: "u1",
    });
    expect(r2.result).toBe("noop");
    expect(propertyUpdate).toHaveBeenCalledTimes(1);
    expect(amenityCreateMany).not.toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it("failed audit row does NOT block re-apply", async () => {
    previewMock.mockResolvedValue(preview());
    auditCreate.mockResolvedValue({ id: "a1" });
    auditFindFirst.mockResolvedValueOnce(null);

    const r = await applyImportDiff({
      propertyId: "prop_1",
      platform: "airbnb",
      payload: { x: 2 },
      resolutions: {},
      actorUserId: "u1",
    });
    expect(r.result).toBe("success");

    const findArgs = auditFindFirst.mock.calls[0][0] as {
      where: { AND: unknown[] };
    };
    expect(findArgs.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          NOT: expect.objectContaining({
            diffJson: expect.objectContaining({
              path: ["failed"],
              equals: true,
            }),
          }),
        }),
      ]),
    );
  });
});
