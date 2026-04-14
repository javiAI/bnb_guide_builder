import { describe, it, expect, vi, beforeEach } from "vitest";

// Phase 2 / Branch 2B — dual-write coverage.
//
// These tests exercise the helper module's Prisma call surface against
// a mocked prisma client so we can verify the 5 spec scenarios without
// requiring a live database:
//   1. toggle enable → Instance created (+ Placement if spaceId)
//   2. toggle disable → Instance deleted (placements cascade via FK)
//   3. update → Instance updated via composite key
//   4. PropertyAmenity.spaceId=null → Instance("default"), no Placement
//   5. PropertyAmenity.spaceId=X → Instance("space:X") + 1 Placement
//
// A live-DB drift check is provided as `scripts/detect-amenity-drift.ts`
// and must be run after material data changes.

// ── Mock prisma ──
type Call = { op: string; args: unknown };
const { calls } = vi.hoisted(() => ({ calls: [] as Call[] }));

vi.mock("@/lib/db", () => {
  const makeDelegate = (name: string) => ({
    upsert: vi.fn((args: unknown) => {
      calls.push({ op: `${name}.upsert`, args });
      return Promise.resolve({ id: `${name}-upserted` });
    }),
    create: vi.fn((args: unknown) => {
      calls.push({ op: `${name}.create`, args });
      return Promise.resolve({ id: `${name}-created` });
    }),
    update: vi.fn((args: unknown) => {
      calls.push({ op: `${name}.update`, args });
      return Promise.resolve({});
    }),
    updateMany: vi.fn((args: unknown) => {
      calls.push({ op: `${name}.updateMany`, args });
      return Promise.resolve({ count: 1 });
    }),
    delete: vi.fn((args: unknown) => {
      calls.push({ op: `${name}.delete`, args });
      return Promise.resolve({});
    }),
    deleteMany: vi.fn((args: unknown) => {
      calls.push({ op: `${name}.deleteMany`, args });
      return Promise.resolve({ count: 1 });
    }),
    findFirst: vi.fn(() => Promise.resolve(null)),
    findUnique: vi.fn(() => Promise.resolve(null)),
    findMany: vi.fn(() => Promise.resolve([])),
  });
  return {
    prisma: {
      propertyAmenity: makeDelegate("propertyAmenity"),
      propertyAmenityInstance: makeDelegate("propertyAmenityInstance"),
      propertyAmenityPlacement: makeDelegate("propertyAmenityPlacement"),
    },
  };
});

// Import AFTER the mock so the module picks it up.
import {
  instanceKeyFor,
  spaceIdFromInstanceKey,
  mirrorEnableToNew,
  mirrorDisableToNew,
  mirrorUpdateToNew,
  mirrorInstanceToOld,
  mirrorInstanceDeleteToOld,
  mirrorPlacementAddToOld,
  mirrorPlacementRemoveFromOld,
} from "@/lib/amenity-dual-write";

beforeEach(() => {
  calls.length = 0;
});

// ── instance key convention ──

describe("instance key convention", () => {
  it("maps null spaceId to 'default'", () => {
    expect(instanceKeyFor(null)).toBe("default");
  });

  it("maps concrete spaceId to 'space:<id>'", () => {
    expect(instanceKeyFor("s1")).toBe("space:s1");
  });

  it("round-trips canonical keys", () => {
    expect(spaceIdFromInstanceKey(instanceKeyFor(null))).toBeNull();
    expect(spaceIdFromInstanceKey(instanceKeyFor("s1"))).toBe("s1");
  });

  it("returns null for non-canonical instanceKeys", () => {
    expect(spaceIdFromInstanceKey("custom-key")).toBeNull();
  });
});

// ── Old → New mirrors ──

describe("mirrorEnableToNew (scenario 1, 4, 5)", () => {
  it("upserts only Instance when spaceId is null (scenario 4)", async () => {
    await mirrorEnableToNew({ propertyId: "p1", amenityKey: "am.wifi", spaceId: null });
    const ops = calls.map((c) => c.op);
    expect(ops).toContain("propertyAmenityInstance.upsert");
    expect(ops).not.toContain("propertyAmenityPlacement.upsert");
  });

  it("upserts Instance + Placement when spaceId is provided (scenario 5)", async () => {
    await mirrorEnableToNew({ propertyId: "p1", amenityKey: "am.shower", spaceId: "s1" });
    const ops = calls.map((c) => c.op);
    expect(ops).toContain("propertyAmenityInstance.upsert");
    expect(ops).toContain("propertyAmenityPlacement.upsert");
  });

  it("derives instanceKey from spaceId", async () => {
    await mirrorEnableToNew({ propertyId: "p1", amenityKey: "am.shower", spaceId: "s42" });
    const upsert = calls.find((c) => c.op === "propertyAmenityInstance.upsert");
    expect(upsert).toBeDefined();
    const args = upsert!.args as { where: { propertyId_amenityKey_instanceKey: { instanceKey: string } } };
    expect(args.where.propertyId_amenityKey_instanceKey.instanceKey).toBe("space:s42");
  });
});

describe("mirrorDisableToNew (scenario 2)", () => {
  it("deletes Instance by composite key (placements cascade via FK)", async () => {
    await mirrorDisableToNew({ propertyId: "p1", amenityKey: "am.wifi", spaceId: null });
    const del = calls.find((c) => c.op === "propertyAmenityInstance.deleteMany");
    expect(del).toBeDefined();
    const args = del!.args as { where: { instanceKey: string } };
    expect(args.where.instanceKey).toBe("default");
    // No direct placement delete — relies on FK cascade.
    expect(calls.map((c) => c.op)).not.toContain("propertyAmenityPlacement.deleteMany");
  });
});

describe("mirrorUpdateToNew (scenario 3)", () => {
  it("updates matching Instance via updateMany on composite key", async () => {
    await mirrorUpdateToNew({
      propertyId: "p1",
      amenityKey: "am.wifi",
      spaceId: null,
      data: { guestInstructions: "Red: X" },
    });
    const update = calls.find((c) => c.op === "propertyAmenityInstance.updateMany");
    expect(update).toBeDefined();
    const args = update!.args as { where: { instanceKey: string }; data: { guestInstructions: string } };
    expect(args.where.instanceKey).toBe("default");
    expect(args.data.guestInstructions).toBe("Red: X");
  });
});

// ── New → Old mirrors ──

describe("mirrorInstanceToOld (reverse direction)", () => {
  const baseInstance = {
    id: "i1",
    propertyId: "p1",
    amenityKey: "am.wifi",
    subtypeKey: null,
    detailsJson: null,
    guestInstructions: null,
    aiInstructions: null,
    internalNotes: null,
    troubleshootingNotes: null,
    visibility: "public",
  };

  it("creates legacy PropertyAmenity for a 'default' instance with no prior row", async () => {
    await mirrorInstanceToOld({ ...baseInstance, instanceKey: "default" });
    expect(calls.map((c) => c.op)).toContain("propertyAmenity.create");
  });

  it("derives legacy spaceId from 'space:X' instanceKey", async () => {
    await mirrorInstanceToOld({ ...baseInstance, instanceKey: "space:s9" });
    const create = calls.find((c) => c.op === "propertyAmenity.create");
    expect(create).toBeDefined();
    const args = create!.args as { data: { space?: { connect: { id: string } } } };
    expect(args.data.space?.connect.id).toBe("s9");
  });

  it("skips mirror entirely for non-canonical instanceKey", async () => {
    await mirrorInstanceToOld({ ...baseInstance, instanceKey: "custom_123" });
    expect(calls.length).toBe(0);
  });
});

describe("mirrorInstanceDeleteToOld", () => {
  it("deleteMany by composite key when instanceKey is canonical", async () => {
    await mirrorInstanceDeleteToOld({ propertyId: "p1", amenityKey: "am.wifi", instanceKey: "default" });
    expect(calls.map((c) => c.op)).toContain("propertyAmenity.deleteMany");
  });

  it("skips non-canonical instanceKey", async () => {
    await mirrorInstanceDeleteToOld({ propertyId: "p1", amenityKey: "am.wifi", instanceKey: "custom" });
    expect(calls.length).toBe(0);
  });
});

describe("placement mirrors", () => {
  it("mirrorPlacementAddToOld creates legacy row when none exists", async () => {
    await mirrorPlacementAddToOld({ propertyId: "p1", amenityKey: "am.shower", spaceId: "s1" });
    expect(calls.map((c) => c.op)).toContain("propertyAmenity.create");
  });

  it("mirrorPlacementRemoveFromOld deletes legacy rows for the space", async () => {
    await mirrorPlacementRemoveFromOld({ propertyId: "p1", amenityKey: "am.shower", spaceId: "s1" });
    const del = calls.find((c) => c.op === "propertyAmenity.deleteMany");
    expect(del).toBeDefined();
    const args = del!.args as { where: { spaceId: string } };
    expect(args.where.spaceId).toBe("s1");
  });
});
