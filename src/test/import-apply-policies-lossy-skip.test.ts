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
      scalar: [],
      policies: [
        {
          field: "policies.events.policy",
          incoming: "allowed",
          status: "unactionable",
          reason: "lossy_projection",
          message: "Binary mapping degrades granularity.",
        },
      ],
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

describe("applyImportDiff — lossy_projection policies are server-skipped + warning, no failure", () => {
  beforeEach(() => {
    auditCreate.mockReset();
    auditCreate.mockResolvedValue({ id: "a1" });
    propertyUpdate.mockClear();
    previewMock.mockReset();
    previewMock.mockResolvedValue(preview());
  });

  it("succeeds, mutation skipped, warning emitted in audit row", async () => {
    const r = await applyImportDiff({
      propertyId: "prop_1",
      platform: "airbnb",
      payload: {},
      resolutions: {},
      actorUserId: "u1",
    });
    expect(r.result).toBe("success");
    if (r.result !== "success") return;

    const skipped = r.skipped.find(
      (m) => m.field === "policies.events.policy",
    );
    expect(skipped?.reason).toBe("server_unactionable");

    expect(propertyUpdate).not.toHaveBeenCalled();
    expect(r.warnings.some((w) => w.message.includes("policies.events.policy"))).toBe(true);
  });

  it("client cannot override the server skip", async () => {
    const r = await applyImportDiff({
      propertyId: "prop_1",
      platform: "airbnb",
      payload: {},
      resolutions: { "policies.events.policy": "take_import" },
      actorUserId: "u1",
    });
    expect(r.result).toBe("success");
    if (r.result !== "success") return;
    const skipped = r.skipped.find(
      (m) => m.field === "policies.events.policy",
    );
    expect(skipped?.reason).toBe("server_unactionable");
    expect(r.applied.find((m) => m.field === "policies.events.policy")).toBeUndefined();
  });
});
