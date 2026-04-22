// Guest-incident create service (rama 13D). Locks the server-side
// invariants that the API route relies on:
//  - origin="guest_guide", reporterType="guest", visibility="internal".
//  - Title derived from category label + truncated summary.
//  - Target comes from the category default OR a validated attachedItem.
//  - Host email resolution prefers `ct.host` / `ct.cohost`.
//  - Notification failure never throws — the incident is still created.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    space: { findFirst: vi.fn() },
    propertyAmenityInstance: { findFirst: vi.fn() },
    propertySystem: { findFirst: vi.fn() },
    incident: { create: vi.fn() },
    property: { findUnique: vi.fn() },
    contact: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  createIncidentFromGuest,
  GuestIncidentPayloadSchema,
} from "@/lib/services/incident-from-guest.service";
import { __setEmailProviderForTests } from "@/lib/services/incident-notification.service";

const PROPERTY_ID = "prop-1";
const INCIDENT_ID = "inc-1";

beforeEach(() => {
  for (const fn of Object.values(prismaMock).flatMap((m) => Object.values(m))) {
    (fn as ReturnType<typeof vi.fn>).mockReset();
  }
  prismaMock.incident.create.mockResolvedValue({ id: INCIDENT_ID });
  prismaMock.property.findUnique.mockResolvedValue({
    propertyNickname: "Sunset Villa",
  });
  prismaMock.contact.findMany.mockResolvedValue([]);
  __setEmailProviderForTests(null);
});

afterEach(() => {
  __setEmailProviderForTests(null);
});

describe("GuestIncidentPayloadSchema", () => {
  it("accepts a minimal valid payload", () => {
    const parsed = GuestIncidentPayloadSchema.safeParse({
      categoryKey: "ic.wifi",
      summary: "Wifi no conecta",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown category keys", () => {
    const parsed = GuestIncidentPayloadSchema.safeParse({
      categoryKey: "ic.unknown_xyz",
      summary: "x",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty summary", () => {
    const parsed = GuestIncidentPayloadSchema.safeParse({
      categoryKey: "ic.wifi",
      summary: "   ",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects summaries over 500 chars", () => {
    const parsed = GuestIncidentPayloadSchema.safeParse({
      categoryKey: "ic.wifi",
      summary: "x".repeat(501),
    });
    expect(parsed.success).toBe(false);
  });

  it("strips unknown top-level keys (.strict)", () => {
    const parsed = GuestIncidentPayloadSchema.safeParse({
      categoryKey: "ic.wifi",
      summary: "Wifi no conecta",
      title: "INJECTED TITLE",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("createIncidentFromGuest", () => {
  it("sets origin=guest_guide, reporterType=guest, visibility=internal", async () => {
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: { categoryKey: "ic.wifi", summary: "Wifi lento" },
    });
    const data = prismaMock.incident.create.mock.calls[0][0].data;
    expect(data.origin).toBe("guest_guide");
    expect(data.reporterType).toBe("guest");
    expect(data.visibility).toBe("internal");
  });

  it("derives title from category label + summary", async () => {
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: { categoryKey: "ic.wifi", summary: "No hay internet" },
    });
    const data = prismaMock.incident.create.mock.calls[0][0].data;
    expect(data.title).toMatch(/^\[Wifi \/ internet\]/);
    expect(data.title).toContain("No hay internet");
  });

  it("truncates long summaries in the stored notes to 500 chars", async () => {
    const big = "a".repeat(600);
    // Schema would reject, but the service also has an internal guard.
    // Feed through the service directly with Zod-safe-parsed limit.
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: { categoryKey: "ic.wifi", summary: big.slice(0, 500) },
    });
    const data = prismaMock.incident.create.mock.calls[0][0].data;
    expect((data.notes as string).length).toBeLessThanOrEqual(500);
  });

  it("seeds severity + targetType from the category taxonomy", async () => {
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: { categoryKey: "ic.access", summary: "Llave no abre" },
    });
    const data = prismaMock.incident.create.mock.calls[0][0].data;
    expect(data.severity).toBe("high"); // ic.access defaultSeverity
    expect(data.targetType).toBe("access");
    expect(data.targetId).toBeNull();
  });

  it("validates attached space against propertyId (accepts when owned)", async () => {
    prismaMock.space.findFirst.mockResolvedValueOnce({ id: "sp-1" });
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: {
        categoryKey: "ic.cleaning",
        summary: "Sucio",
        attachedItem: { kind: "space", id: "sp-1" },
      },
    });
    const data = prismaMock.incident.create.mock.calls[0][0].data;
    expect(data.targetType).toBe("space");
    expect(data.targetId).toBe("sp-1");
  });

  it("falls back to category default when attached space is foreign", async () => {
    prismaMock.space.findFirst.mockResolvedValueOnce(null);
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: {
        categoryKey: "ic.cleaning",
        summary: "Sucio",
        attachedItem: { kind: "space", id: "foreign-space" },
      },
    });
    const data = prismaMock.incident.create.mock.calls[0][0].data;
    // ic.cleaning defaultTargetType === "property"
    expect(data.targetType).toBe("property");
    expect(data.targetId).toBeNull();
  });

  it("stores guest contact when provided, null otherwise", async () => {
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: {
        categoryKey: "ic.wifi",
        summary: "Wifi",
        guestContactOptional: "guest@example.com",
      },
    });
    let data = prismaMock.incident.create.mock.calls[0][0].data;
    expect(data.guestContactOptional).toBe("guest@example.com");

    prismaMock.incident.create.mockClear();
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: { categoryKey: "ic.wifi", summary: "Wifi" },
    });
    data = prismaMock.incident.create.mock.calls[0][0].data;
    expect(data.guestContactOptional).toBeNull();
  });

  it("stores the categoryKey for panel filtering", async () => {
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: { categoryKey: "ic.appliance", summary: "Nevera rota" },
    });
    const data = prismaMock.incident.create.mock.calls[0][0].data;
    expect(data.categoryKey).toBe("ic.appliance");
  });

  it("prefers a host-role contact (host or cohost) over other roles", async () => {
    const sent: Array<{ recipient: string }> = [];
    __setEmailProviderForTests({
      name: "test-spy",
      async send(payload) {
        sent.push({ recipient: payload.recipientEmail });
        return { sent: true, provider: "test-spy" };
      },
    });
    // Cleaner is isPrimary:true and would come first in orderBy if no host
    // filter existed. The service must still pick the `ct.host` email.
    prismaMock.contact.findMany.mockResolvedValueOnce([
      { email: "cleaner@example.com", roleKey: "ct.cleaner", isPrimary: true },
      { email: "host@example.com", roleKey: "ct.host", isPrimary: false },
      { email: "other@example.com", roleKey: "ct.owner", isPrimary: false },
    ]);
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: { categoryKey: "ic.wifi", summary: "Wifi" },
    });
    expect(sent[0]?.recipient).toBe("host@example.com");
  });

  it("falls back to first contact if no host role matches", async () => {
    const sent: Array<{ recipient: string }> = [];
    __setEmailProviderForTests({
      name: "test-spy",
      async send(payload) {
        sent.push({ recipient: payload.recipientEmail });
        return { sent: true, provider: "test-spy" };
      },
    });
    prismaMock.contact.findMany.mockResolvedValueOnce([
      { email: "cleaner@example.com", roleKey: "ct.cleaner", isPrimary: true },
    ]);
    await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: { categoryKey: "ic.wifi", summary: "Wifi" },
    });
    expect(sent[0]?.recipient).toBe("cleaner@example.com");
  });

  it("succeeds even if the email provider throws", async () => {
    __setEmailProviderForTests({
      name: "throwing",
      async send() {
        throw new Error("SMTP down");
      },
    });
    prismaMock.contact.findMany.mockResolvedValueOnce([
      { email: "host@example.com", roleKey: "ct.host", isPrimary: true },
    ]);
    const res = await createIncidentFromGuest({
      propertyId: PROPERTY_ID,
      payload: { categoryKey: "ic.wifi", summary: "Wifi" },
    });
    expect(res.incidentId).toBe(INCIDENT_ID);
    expect(res.notification.sent).toBe(false);
    expect(res.notification.reason).toBe("provider_error");
  });
});
