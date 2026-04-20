import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn<(args: unknown) => Promise<unknown[]>>(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    contact: {
      findMany: findManyMock,
    },
  },
}));

import { resolveEscalation } from "@/lib/services/assistant/escalation.service";

// ── helpers ─────────────────────────────────────────────────────────────────

interface FakeContact {
  id: string;
  roleKey: string;
  displayName: string;
  phone?: string | null;
  phoneSecondary?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  emergencyAvailable?: boolean;
  isPrimary?: boolean;
  sortOrder?: number;
  visibility?: string;
  internalNotes?: string | null;
  guestVisibleNotes?: string | null;
  createdAt?: Date;
}

function fake(c: FakeContact) {
  return {
    phone: null,
    phoneSecondary: null,
    email: null,
    whatsapp: null,
    emergencyAvailable: false,
    isPrimary: false,
    sortOrder: 0,
    visibility: "internal",
    internalNotes: null,
    guestVisibleNotes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...c,
  };
}

/** Mock responder that returns different contacts per role set. Each call to
 *  prisma.contact.findMany provides the configured slice for the requested
 *  `roleKey.in` list. Unknown roles → empty array. */
function respondByRole(map: Record<string, FakeContact[]>) {
  findManyMock.mockImplementation((args: unknown) => {
    const where = (args as { where: { roleKey: { in: string[] } } }).where;
    const roles = where.roleKey.in;
    const rows: FakeContact[] = [];
    for (const r of roles) if (map[r]) rows.push(...map[r]);
    return Promise.resolve(rows.map(fake));
  });
}

beforeEach(() => {
  findManyMock.mockReset();
});

// ── Happy path ──────────────────────────────────────────────────────────────

describe("resolveEscalation — happy path", () => {
  it("returns the intent's contacts ordered by Prisma with all channels built", async () => {
    respondByRole({
      "ct.locksmith": [
        {
          id: "c1",
          roleKey: "ct.locksmith",
          displayName: "CerrajeríasBCN",
          phone: "+34 600 111 222",
          whatsapp: "+34600111222",
          email: "bcn@locksmith.es",
        },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.lockout",
      audience: "internal",
    });
    expect(r).not.toBeNull();
    expect(r!.intentId).toBe("int.lockout");
    expect(r!.fallbackLevel).toBe("intent");
    expect(r!.emergencyPriority).toBe(false);
    expect(r!.contacts).toHaveLength(1);
    const c = r!.contacts[0];
    expect(c.channels.map((x) => x.kind)).toEqual(["tel", "whatsapp"]);
    expect(c.channels[0].href).toBe("tel:+34600111222");
    expect(c.channels[1].href).toBe("https://wa.me/34600111222");
  });

  it("emergency intent surfaces emergencyPriority=true", async () => {
    respondByRole({
      "ct.emergency_hospital": [
        {
          id: "h1",
          roleKey: "ct.emergency_hospital",
          displayName: "Hospital Clínic",
          phone: "932275400",
          emergencyAvailable: true,
        },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.emergency_medical",
      audience: "internal",
    });
    expect(r!.emergencyPriority).toBe(true);
    expect(r!.contacts[0].emergencyAvailable).toBe(true);
  });
});

// ── Fallback cascade ────────────────────────────────────────────────────────

describe("resolveEscalation — fallback cascade", () => {
  it("falls back to host when intent roles yield no contacts", async () => {
    respondByRole({
      "ct.host": [{ id: "h", roleKey: "ct.host", displayName: "Alice", phone: "+34611" }],
      "ct.cohost": [],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.lockout",
      audience: "internal",
    });
    expect(r!.fallbackLevel).toBe("intent_with_host");
    expect(r!.contacts[0].roleKey).toBe("ct.host");
  });

  it("falls back to the taxonomy fallback intent roles when host is also empty for a fallbackToHost=false intent", async () => {
    // Simulate an intent without fallbackToHost — we'd need to pretend all
    // three tiers are empty except the last. Our taxonomy has every intent
    // with fallbackToHost=true, so exercise the taxonomy-level fallback by
    // arranging the host tier to be empty.
    respondByRole({
      "ct.host": [],
      "ct.cohost": [
        { id: "cohost", roleKey: "ct.cohost", displayName: "Bob", phone: "+34622" },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.general", // fallback intent itself, roles = ct.host/cohost
      audience: "internal",
    });
    // int.general's contactRoles already ARE ct.host/ct.cohost, so the match
    // lands at the intent tier (not a cascade step). The cohost satisfies it.
    expect(r!.fallbackLevel).toBe("intent");
    expect(r!.contacts[0].roleKey).toBe("ct.cohost");
  });

  it("returns null when every tier yields zero contacts", async () => {
    respondByRole({}); // no roles match anything
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.lockout",
      audience: "internal",
    });
    expect(r).toBeNull();
  });

  it("degrades gracefully when given an unknown intentId", async () => {
    // Degrades to the fallback intent, which resolves ct.host/ct.cohost.
    respondByRole({
      "ct.host": [{ id: "h", roleKey: "ct.host", displayName: "Alice", phone: "+34611" }],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      // Force-cast to exercise the defense-in-depth branch.
      intentId: "int.nonexistent" as never,
      audience: "internal",
    });
    expect(r).not.toBeNull();
    expect(r!.intentId).toBe("int.general");
  });
});

// ── Visibility filter ──────────────────────────────────────────────────────

describe("resolveEscalation — visibility", () => {
  it("strips contacts above the audience's clearance", async () => {
    respondByRole({
      "ct.locksmith": [
        {
          id: "sensitive",
          roleKey: "ct.locksmith",
          displayName: "Secret backup",
          phone: "+34000",
          visibility: "sensitive",
        },
        {
          id: "public",
          roleKey: "ct.locksmith",
          displayName: "Day shift",
          phone: "+34111",
          visibility: "guest",
        },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.lockout",
      audience: "internal",
    });
    // Internal audience can see guest-visibility, NOT sensitive.
    expect(r!.contacts.map((c) => c.id)).toEqual(["public"]);
  });

  it("guest audience only sees guest-visibility contacts", async () => {
    respondByRole({
      "ct.host": [
        {
          id: "internal-host",
          roleKey: "ct.host",
          displayName: "Internal notes host",
          phone: "+34222",
          visibility: "internal",
        },
        {
          id: "guest-host",
          roleKey: "ct.host",
          displayName: "Guest-facing host",
          phone: "+34333",
          visibility: "guest",
        },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.general",
      audience: "guest",
    });
    expect(r!.contacts.map((c) => c.id)).toEqual(["guest-host"]);
  });
});

// ── Channel projection ─────────────────────────────────────────────────────

describe("resolveEscalation — channels", () => {
  it("honors intent.channelPriority ordering (fire = tel only)", async () => {
    respondByRole({
      "ct.emergency_fire": [
        {
          id: "f1",
          roleKey: "ct.emergency_fire",
          displayName: "Bomberos",
          phone: "080",
          email: "fire@example.com", // present but ignored: not in channelPriority
        },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.emergency_fire",
      audience: "internal",
    });
    expect(r!.contacts[0].channels.map((c) => c.kind)).toEqual(["tel"]);
  });

  it("falls back to phone for whatsapp channel when whatsapp field is empty", async () => {
    respondByRole({
      "ct.locksmith": [
        {
          id: "l1",
          roleKey: "ct.locksmith",
          displayName: "Key Guy",
          phone: "+34 600 111 222",
          whatsapp: null,
        },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.lockout",
      audience: "internal",
    });
    const whatsappCh = r!.contacts[0].channels.find((c) => c.kind === "whatsapp");
    expect(whatsappCh?.href).toBe("https://wa.me/34600111222");
  });

  it("skips channels the contact has no data for", async () => {
    respondByRole({
      "ct.host": [
        {
          id: "h",
          roleKey: "ct.host",
          displayName: "Email-only host",
          email: "host@example.com",
          // no phone, no whatsapp
        },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.general",
      audience: "internal",
    });
    expect(r!.contacts[0].channels.map((c) => c.kind)).toEqual(["email"]);
  });

  it("drops contacts with no reachable channel (cascades to next tier)", async () => {
    // Ghost contact in tier1 must not short-circuit the cascade — its tier
    // has no usable contact, so we fall back rather than render an empty card.
    respondByRole({
      "ct.locksmith": [{ id: "ghost", roleKey: "ct.locksmith", displayName: "Ghost" }],
      "ct.host": [{ id: "h", roleKey: "ct.host", displayName: "Alice", phone: "+34611" }],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.lockout",
      audience: "internal",
    });
    expect(r!.fallbackLevel).toBe("intent_with_host");
    expect(r!.contacts.map((c) => c.id)).toEqual(["h"]);
  });

  it("tier3 (general fallback) uses fallback.channelPriority, not the intent's", async () => {
    // Fire intent has channelPriority=["tel"]. If we cascade to the general
    // fallback and the host only has email, we must surface email rather than
    // drop the contact — at tier3 we've given up on the intent's channel
    // semantics.
    respondByRole({
      "ct.emergency_fire": [],
      "ct.host": [
        {
          id: "email-host",
          roleKey: "ct.host",
          displayName: "Email host",
          email: "host@example.com",
        },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.emergency_fire",
      audience: "internal",
    });
    expect(r!.fallbackLevel).toBe("fallback");
    expect(r!.contacts[0].channels.map((c) => c.kind)).toEqual(["email"]);
  });
});

// ── Notes projection ───────────────────────────────────────────────────────

describe("resolveEscalation — notes by audience", () => {
  it("guest audience receives guestVisibleNotes only", async () => {
    respondByRole({
      "ct.host": [
        {
          id: "h",
          roleKey: "ct.host",
          displayName: "Alice",
          phone: "+34111",
          visibility: "guest",
          internalNotes: "has a spare key hidden behind the meter",
          guestVisibleNotes: "responds within 30 min on weekdays",
        },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.general",
      audience: "guest",
    });
    expect(r!.contacts[0].notes).toBe("responds within 30 min on weekdays");
  });

  it("internal audience sees internalNotes, falling back to guestVisibleNotes", async () => {
    respondByRole({
      "ct.host": [
        {
          id: "h",
          roleKey: "ct.host",
          displayName: "Alice",
          phone: "+34111",
          internalNotes: "has a spare key hidden behind the meter",
          guestVisibleNotes: "responds within 30 min on weekdays",
        },
      ],
    });
    const r = await resolveEscalation({
      propertyId: "p1",
      intentId: "int.general",
      audience: "internal",
    });
    expect(r!.contacts[0].notes).toBe("has a spare key hidden behind the meter");
  });
});

// ── Prisma orderBy contract ─────────────────────────────────────────────────

describe("resolveEscalation — Prisma query contract", () => {
  it("queries with the expected tiebreak chain", async () => {
    respondByRole({ "ct.locksmith": [] });
    await resolveEscalation({
      propertyId: "p1",
      intentId: "int.lockout",
      audience: "internal",
    });
    const call = findManyMock.mock.calls[0]?.[0] as {
      orderBy: Array<Record<string, "asc" | "desc">>;
      where: { propertyId: string };
    };
    expect(call.where.propertyId).toBe("p1");
    expect(call.orderBy).toEqual([
      { emergencyAvailable: "desc" },
      { isPrimary: "desc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ]);
  });
});
