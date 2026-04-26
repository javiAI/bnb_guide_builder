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

describe("applyImportDiff — happy path audit envelope", () => {
  beforeEach(() => {
    auditCreate.mockReset();
    auditCreate.mockResolvedValue({ id: "a1" });
    propertyUpdate.mockClear();
    previewMock.mockReset();
  });

  it("writes a single audit row with platform, fingerprint, applied[], skipped[], warnings[]", async () => {
    previewMock.mockResolvedValue(preview());

    const r = await applyImportDiff({
      propertyId: "prop_1",
      platform: "airbnb",
      payload: { foo: "bar" },
      resolutions: {},
      actorUserId: "u1",
    });
    expect(r.result).toBe("success");

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const args = auditCreate.mock.calls[0][0] as {
      data: {
        propertyId: string;
        actor: string;
        entityType: string;
        entityId: string;
        action: string;
        diffJson: {
          platform: string;
          payloadFingerprint: string;
          applied: unknown[];
          skipped: unknown[];
          warnings: unknown[];
        };
      };
    };
    expect(args.data.propertyId).toBe("prop_1");
    expect(args.data.actor).toBe("user:u1");
    expect(args.data.entityType).toBe("Property");
    expect(args.data.entityId).toBe("prop_1");
    expect(args.data.action).toBe("import.apply");
    expect(args.data.diffJson.platform).toBe("airbnb");
    expect(args.data.diffJson.payloadFingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(Array.isArray(args.data.diffJson.applied)).toBe(true);
    expect(Array.isArray(args.data.diffJson.skipped)).toBe(true);
    expect(Array.isArray(args.data.diffJson.warnings)).toBe(true);
  });
});
