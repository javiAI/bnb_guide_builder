import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// Stub the operator session resolver so the mutations exercise the audit
// path without needing a real cookie / DB session.
vi.mock("@/lib/auth/require-operator", () => ({
  requireOperator: vi.fn().mockResolvedValue({
    userId: "u1",
    workspaceId: "ws1",
    user: { id: "u1", email: "u@example.com", name: null },
    memberships: [{ workspaceId: "ws1", role: "owner" }],
  }),
}));

// Audit writes are fail-soft and tested elsewhere — no-op here.
vi.mock("@/lib/services/audit.service", () => ({
  AUDIT_ACTIONS: {
    create: "create",
    update: "update",
    delete: "delete",
    publish: "publish",
    unpublish: "unpublish",
    rollback: "rollback",
    sessionStart: "session.start",
    sessionEnd: "session.end",
  },
  formatActor: vi.fn((input) =>
    input.type === "user" ? `user:${input.userId}` : `${input.type}:_`,
  ),
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => {
  const prismaMock = {
    incident: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
    },
    property: { findUnique: vi.fn() },
    propertySystem: { findUnique: vi.fn() },
    propertyAmenityInstance: { findUnique: vi.fn() },
    space: { findUnique: vi.fn() },
    troubleshootingPlaybook: { findUnique: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { prisma } from "@/lib/db";
import {
  createIncidentAction,
  updateIncidentAction,
  deleteIncidentAction,
  resolveIncidentAction,
} from "@/lib/actions/incident.actions";

const propertyFindUnique = prisma.property.findUnique as ReturnType<typeof vi.fn>;
const incidentFindUnique = prisma.incident.findUnique as ReturnType<typeof vi.fn>;
const incidentCreate = prisma.incident.create as ReturnType<typeof vi.fn>;
const incidentUpdate = prisma.incident.update as ReturnType<typeof vi.fn>;
const incidentDelete = prisma.incident.delete as ReturnType<typeof vi.fn>;
const systemFindUnique = prisma.propertySystem.findUnique as ReturnType<typeof vi.fn>;
const amenityFindUnique = prisma.propertyAmenityInstance.findUnique as ReturnType<typeof vi.fn>;
const spaceFindUnique = prisma.space.findUnique as ReturnType<typeof vi.fn>;
const playbookFindUnique = prisma.troubleshootingPlaybook.findUnique as ReturnType<typeof vi.fn>;

beforeEach(() => {
  propertyFindUnique.mockReset().mockResolvedValue({ id: "p1", timezone: null });
  incidentFindUnique.mockReset();
  incidentCreate.mockReset().mockResolvedValue({});
  incidentUpdate.mockReset().mockResolvedValue({});
  incidentDelete.mockReset().mockResolvedValue({});
  systemFindUnique.mockReset();
  amenityFindUnique.mockReset();
  spaceFindUnique.mockReset();
  playbookFindUnique.mockReset();
});

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("incident CRUD", () => {
  it("creates an incident targeted at the property", async () => {
    const res = await createIncidentAction(
      null,
      form({
        propertyId: "p1",
        title: "Corte de luz",
        targetType: "property",
        occurredAt: "2026-04-15T10:00",
      }),
    );
    expect(res).toEqual({ success: true });
    const call = incidentCreate.mock.calls[0][0];
    expect(call.data).toMatchObject({
      propertyId: "p1",
      title: "Corte de luz",
      targetType: "property",
      targetId: null,
      status: "open",
      severity: "medium",
    });
  });

  it("creates an incident targeted at a system and validates ownership", async () => {
    systemFindUnique.mockResolvedValue({ propertyId: "p1" });
    const res = await createIncidentAction(
      null,
      form({
        propertyId: "p1",
        title: "Wifi caído",
        targetType: "system",
        targetId: "sys-123",
        severity: "high",
        occurredAt: "2026-04-15T10:00",
      }),
    );
    expect(res).toEqual({ success: true });
    const call = incidentCreate.mock.calls[0][0];
    expect(call.data).toMatchObject({
      targetType: "system",
      targetId: "sys-123",
      severity: "high",
    });
  });

  it("rejects a target from a different property", async () => {
    spaceFindUnique.mockResolvedValue({ propertyId: "other" });
    const res = await createIncidentAction(
      null,
      form({
        propertyId: "p1",
        title: "Humo cocina",
        targetType: "space",
        targetId: "s1",
        occurredAt: "2026-04-15T10:00",
      }),
    );
    expect(res).toEqual({ success: false, error: "El espacio no pertenece a la propiedad" });
    expect(incidentCreate).not.toHaveBeenCalled();
  });

  it("rejects an incident without targetId when targetType != property", async () => {
    const res = await createIncidentAction(
      null,
      form({
        propertyId: "p1",
        title: "Sin target",
        targetType: "system",
        occurredAt: "2026-04-15T10:00",
      }),
    );
    expect(res.success).toBe(false);
    expect(incidentCreate).not.toHaveBeenCalled();
  });

  it("accepts access-method target without DB lookup (taxonomy-keyed)", async () => {
    const res = await createIncidentAction(
      null,
      form({
        propertyId: "p1",
        title: "Cerradura trabada",
        targetType: "access",
        targetId: "am.keypad",
        occurredAt: "2026-04-15T10:00",
      }),
    );
    expect(res).toEqual({ success: true });
    expect(systemFindUnique).not.toHaveBeenCalled();
    expect(spaceFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a playbook from another property", async () => {
    playbookFindUnique.mockResolvedValue({ propertyId: "other" });
    const res = await createIncidentAction(
      null,
      form({
        propertyId: "p1",
        title: "Inc con playbook ajeno",
        targetType: "property",
        playbookId: "pb-1",
        occurredAt: "2026-04-15T10:00",
      }),
    );
    expect(res).toEqual({ success: false, error: "El playbook no pertenece a la propiedad" });
    expect(incidentCreate).not.toHaveBeenCalled();
  });

  it("updates incident, auto-stamps resolvedAt on status=resolved from open", async () => {
    incidentFindUnique.mockResolvedValue({
      propertyId: "p1",
      status: "open",
      resolvedAt: null,
      visibility: "internal",
      playbookId: null,
      property: { timezone: null, workspaceId: "ws1" },
    });
    await updateIncidentAction(
      null,
      form({
        incidentId: "i1",
        title: "Corte",
        targetType: "property",
        status: "resolved",
        severity: "medium",
        occurredAt: "2026-04-15T10:00",
      }),
    );
    const call = incidentUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: "i1" });
    expect(call.data.status).toBe("resolved");
    expect(call.data.resolvedAt).toBeInstanceOf(Date);
  });

  it("updates incident, preserves existing resolvedAt when status unchanged", async () => {
    const existingResolvedAt = new Date("2026-04-10T12:00:00Z");
    incidentFindUnique.mockResolvedValue({
      propertyId: "p1",
      status: "resolved",
      resolvedAt: existingResolvedAt,
      visibility: "internal",
      playbookId: null,
      property: { timezone: null, workspaceId: "ws1" },
    });
    await updateIncidentAction(
      null,
      form({
        incidentId: "i1",
        title: "Corte (retitled)",
        targetType: "property",
        status: "resolved",
        severity: "medium",
        occurredAt: "2026-04-15T10:00",
      }),
    );
    const call = incidentUpdate.mock.calls[0][0];
    expect(call.data.resolvedAt).toBe(existingResolvedAt);
  });

  it("updates incident, clears resolvedAt when reopening", async () => {
    incidentFindUnique.mockResolvedValue({
      propertyId: "p1",
      status: "resolved",
      resolvedAt: new Date("2026-04-10T12:00:00Z"),
      visibility: "internal",
      playbookId: null,
      property: { timezone: null, workspaceId: "ws1" },
    });
    await updateIncidentAction(
      null,
      form({
        incidentId: "i1",
        title: "Reabierta",
        targetType: "property",
        status: "open",
        severity: "medium",
        occurredAt: "2026-04-15T10:00",
      }),
    );
    const call = incidentUpdate.mock.calls[0][0];
    expect(call.data.status).toBe("open");
    expect(call.data.resolvedAt).toBeNull();
  });

  it("resolveIncidentAction flips status and stamps resolvedAt", async () => {
    incidentFindUnique.mockResolvedValue({
      propertyId: "p1",
      status: "open",
      property: { workspaceId: "ws1" },
    });
    await resolveIncidentAction(null, form({ incidentId: "i1" }));
    const call = incidentUpdate.mock.calls[0][0];
    expect(call.data.status).toBe("resolved");
    expect(call.data.resolvedAt).toBeInstanceOf(Date);
  });

  it("deletes incident only after ownership check", async () => {
    incidentFindUnique.mockResolvedValue({
      propertyId: "p1",
      title: "T",
      status: "open",
      property: { workspaceId: "ws1" },
    });
    const res = await deleteIncidentAction(null, form({ incidentId: "i1" }));
    expect(res).toEqual({ success: true });
    expect(incidentDelete).toHaveBeenCalledWith({ where: { id: "i1" } });
  });

  it("delete returns error for missing incident", async () => {
    incidentFindUnique.mockResolvedValue(null);
    const res = await deleteIncidentAction(null, form({ incidentId: "missing" }));
    expect(res).toEqual({ success: false, error: "Ocurrencia no encontrada" });
    expect(incidentDelete).not.toHaveBeenCalled();
  });
});

describe("incident — schema", () => {
  it("Incident model has target columns, playbook FK, and status default", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf-8");
    const model = src.match(/model Incident \{[\s\S]*?^\}/m)?.[0] ?? "";
    expect(model).toMatch(/targetType\s+String/);
    expect(model).toMatch(/targetId\s+String\?/);
    expect(model).toMatch(/playbookId\s+String\?/);
    expect(model).toMatch(/status\s+String\s+@default\("open"\)/);
    expect(model).toMatch(/playbook\s+TroubleshootingPlaybook\?\s+@relation/);
    expect(model).toMatch(/@@index\(\[\s*propertyId\s*,\s*status\s*\]\)/);
    expect(model).toMatch(/@@index\(\[\s*propertyId\s*,\s*targetType\s*,\s*targetId\s*\]\)/);
  });
});
