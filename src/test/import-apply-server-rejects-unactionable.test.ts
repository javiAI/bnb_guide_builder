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
      scalar: [],
      policies: [],
      presence: [
        {
          field: "shared_spaces.kitchen",
          incoming: true,
          status: "unactionable",
          reason: "presence_signal_only",
          message: "presence",
        },
      ],
      amenities: { add: [], remove: [], identicalCount: 0 },
      freeText: [
        { field: "houseRules", current: null, incoming: "no fumar." },
      ],
      customs: [
        {
          field: "propertyType",
          sourceExternalId: "x",
          sourceLabelEn: null,
          reason: "no_matching_taxonomy_item",
          suggestedCustomLabel: "x",
        },
      ],
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

describe("applyImportDiff — server rejects resolutions on non-actionable categories", () => {
  beforeEach(() => {
    auditCreate.mockReset();
    previewMock.mockReset();
    previewMock.mockResolvedValue(preview());
  });

  it("freeText resolution → result:invalid", async () => {
    const r = await applyImportDiff({
      propertyId: "p1",
      platform: "airbnb",
      payload: {},
      resolutions: { "freeText.houseRules": "take_import" },
      actorUserId: "u1",
    });
    expect(r.result).toBe("invalid");
    if (r.result !== "invalid") return;
    expect(r.field).toBe("freeText.houseRules");
    expect(r.reason).toBe("non_actionable_category");
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("presence resolution → result:invalid", async () => {
    const r = await applyImportDiff({
      propertyId: "p1",
      platform: "airbnb",
      payload: {},
      resolutions: { "presence.shared_spaces.kitchen": "take_import" },
      actorUserId: "u1",
    });
    expect(r.result).toBe("invalid");
    if (r.result !== "invalid") return;
    expect(r.field).toBe("presence.shared_spaces.kitchen");
  });

  it("customs resolution → result:invalid", async () => {
    const r = await applyImportDiff({
      propertyId: "p1",
      platform: "airbnb",
      payload: {},
      resolutions: { "customs.propertyType": "take_import" },
      actorUserId: "u1",
    });
    expect(r.result).toBe("invalid");
  });
});
