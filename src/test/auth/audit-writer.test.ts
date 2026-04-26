import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma BEFORE importing the service so the module-level binding sees
// the stub. Each test resets the captured payload via beforeEach.
const auditCreate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: (args: unknown) => auditCreate(args),
    },
  },
}));

import {
  AUDIT_ACTIONS,
  assertAuditAction,
  formatActor,
  writeAudit,
} from "@/lib/services/audit.service";

describe("writeAudit", () => {
  beforeEach(() => {
    auditCreate.mockReset();
  });

  it("writes a row with redacted diff", async () => {
    auditCreate.mockResolvedValueOnce({ id: "a1" });
    await writeAudit({
      propertyId: "prop_1",
      actor: formatActor({ type: "user", userId: "u1" }),
      entityType: "Incident",
      entityId: "inc_1",
      action: AUDIT_ACTIONS.create,
      diff: { title: "Fugue", access_code: "1234" },
    });
    expect(auditCreate).toHaveBeenCalledTimes(1);
    const args = auditCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(args.data.propertyId).toBe("prop_1");
    expect(args.data.actor).toBe("user:u1");
    expect(args.data.action).toBe("create");
    expect(args.data.diffJson).toEqual({ title: "Fugue", access_code: "[REDACTED]" });
  });

  it("accepts propertyId=null for global audits (session.start/end)", async () => {
    auditCreate.mockResolvedValueOnce({ id: "a2" });
    await writeAudit({
      propertyId: null,
      actor: formatActor({ type: "user", userId: "u1" }),
      entityType: "Session",
      entityId: "u1",
      action: AUDIT_ACTIONS.sessionStart,
    });
    const args = auditCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(args.data.propertyId).toBeNull();
    // Prisma.JsonNull is the sentinel for "JSON null" — not the same as undefined.
    expect(args.data.diffJson).toBeDefined();
  });

  it("is fail-soft — DB errors are swallowed and not propagated", async () => {
    auditCreate.mockRejectedValueOnce(new Error("DB down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      writeAudit({
        propertyId: "p1",
        actor: "user:u1",
        entityType: "Incident",
        entityId: "i1",
        action: AUDIT_ACTIONS.update,
      }),
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("rejects unknown action strings via assertAuditAction (fail-soft path logs)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await writeAudit({
      propertyId: "p1",
      actor: "user:u1",
      entityType: "Incident",
      entityId: "i1",
      action: "frobnicate" as never,
    });
    // The assert throws, fail-soft catches it — write never reaches prisma.
    expect(auditCreate).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("assertAuditAction", () => {
  it("accepts every value of AUDIT_ACTIONS", () => {
    for (const v of Object.values(AUDIT_ACTIONS)) {
      expect(() => assertAuditAction(v)).not.toThrow();
    }
  });

  it("rejects unknown actions", () => {
    expect(() => assertAuditAction("unknown.action")).toThrow();
    expect(() => assertAuditAction("")).toThrow();
  });
});
