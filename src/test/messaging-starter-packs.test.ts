// Starter packs (rama 12C). Covers:
//  - Boot validator: catalog loads (positive) + rejects adversarial fixtures
//    (internal_only token, sensitive_prearrival in wrong touchpoint, wrong
//    trigger, out-of-range offset, unknown propertyType override).
//  - `applyStarterPack` merge-by-slot contract:
//    * first-time apply seeds N templates + N inactive automations
//    * re-apply same pack = effective no-op (content-stable rows unchanged)
//    * host-edited row (origin="user") is never overwritten or duplicated
//    * applying a different pack updates overlapping pack slots and removes
//      left-over pack rows whose slot isn't produced by the new pack
//  - PropertyType override selection.
//  - 12A variable gate: unknown/internal tokens never ship in a pack body.
//
// Slot equivalence key (contract): (propertyId, touchpointKey, channelKey,
// language). A pack MUST NOT create a competing pack row when a user-owned
// row exists for the same slot.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const tx = {
    property: { findUnique: vi.fn() },
    messageTemplate: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    messageAutomation: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const root = {
    ...tx,
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prismaMock: root };
});

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

// Stub variable resolver so previewPack tests don't need a DB.
vi.mock("@/lib/services/messaging-variables.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/messaging-variables.service")
  >("@/lib/services/messaging-variables.service");
  return {
    ...actual,
    resolveVariables: vi.fn(async (_propertyId: string, body: string) => ({
      output: body,
      states: {},
      resolved: [],
      missing: [],
      unknown: [],
      unresolvedContext: [],
    })),
  };
});

import {
  applyStarterPack,
  listAvailablePacks,
  previewPack,
} from "@/lib/services/messaging-seed.service";
import {
  MessagingStarterPacksSchema,
  messagingStarterPacks,
  messagingVariables,
} from "@/lib/taxonomy-loader";
import { validateVariables } from "@/lib/schemas/messaging.schema";

// Pick a real pack at runtime so the test follows whatever ships in the JSON.
const SHIPPED_PACK = messagingStarterPacks.packs[0];
const OTHER_PACK = messagingStarterPacks.packs.find(
  (p) => p.id !== SHIPPED_PACK.id,
)!;

const FIXTURE_PROPERTY = {
  id: "p_1",
  propertyType: "pt.apartment",
};

type AdversarialFixture = {
  file: "messaging_starter_packs.json";
  version: string;
  locale: string;
  packs: Array<{
    id: string;
    name: string;
    tone: string;
    locale: string;
    language: string;
    description: string;
    templates: Array<{
      touchpointKey: string;
      channelKey: string;
      subjectLine?: string;
      bodyTemplate: string;
      automation: { triggerType: string; sendOffsetMinutes: number };
      overrides?: Array<{
        appliesToPropertyTypes: string[];
        patch: { subjectLine?: string; bodyTemplate?: string };
      }>;
    }>;
  }>;
};

function baseFixture(): AdversarialFixture {
  return {
    file: "messaging_starter_packs.json",
    version: "2026-04-21",
    locale: "es",
    packs: [
      {
        id: "msp.test_pack",
        name: "Test — Español",
        tone: "friendly",
        locale: "es",
        language: "es",
        description: "Fixture for schema tests.",
        templates: [
          {
            touchpointKey: "mtp.booking_confirmed",
            channelKey: "ota",
            subjectLine: "Reserva",
            bodyTemplate: "Hola {{guest_name}}, gracias.",
            automation: {
              triggerType: "on_booking_confirmed",
              sendOffsetMinutes: 5,
            },
          },
        ],
      },
    ],
  };
}

// Build a "database row" matching what the pack would produce after apply —
// used to seed findMany so we can assert merge semantics against the real
// shipped pack.
function rowsFromPack(pack: (typeof messagingStarterPacks.packs)[number], opts?: {
  idPrefix?: string;
  origin?: "pack" | "user";
  packId?: string | null;
}): Array<{
  id: string;
  touchpointKey: string;
  channelKey: string;
  language: string;
  origin: "pack" | "user";
  packId: string | null;
  subjectLine: string | null;
  bodyMd: string;
}> {
  const prefix = opts?.idPrefix ?? "tpl_existing_";
  const origin = opts?.origin ?? "pack";
  const packId = opts?.packId !== undefined ? opts.packId : pack.id;
  return pack.templates.map((tpl, i) => ({
    id: `${prefix}${i}`,
    touchpointKey: tpl.touchpointKey,
    channelKey: tpl.channelKey,
    language: pack.language,
    origin,
    packId,
    subjectLine: tpl.subjectLine ?? null,
    bodyMd: tpl.bodyTemplate,
  }));
}

beforeEach(() => {
  prismaMock.$transaction.mockClear();
  prismaMock.property.findUnique.mockReset();
  prismaMock.messageTemplate.findMany.mockReset();
  prismaMock.messageTemplate.deleteMany.mockReset();
  prismaMock.messageTemplate.create.mockReset();
  prismaMock.messageTemplate.update.mockReset();
  prismaMock.messageAutomation.findFirst.mockReset();
  prismaMock.messageAutomation.deleteMany.mockReset();
  prismaMock.messageAutomation.create.mockReset();
  prismaMock.messageAutomation.update.mockReset();
});

// ── Catalog integrity (positive) ──

describe("messaging_starter_packs.json — catalog integrity", () => {
  it("loads at boot without throwing", () => {
    expect(messagingStarterPacks.packs.length).toBeGreaterThan(0);
    expect(messagingStarterPacks.file).toBe("messaging_starter_packs.json");
  });

  it("ships 6 packs (3 tones × 2 locales, mono-locale identity)", () => {
    expect(messagingStarterPacks.packs).toHaveLength(6);
    const identities = new Set(
      messagingStarterPacks.packs.map((p) => `${p.tone}|${p.locale}`),
    );
    expect(identities.size).toBe(6);
  });

  it("every pack has language === locale (mono-locale contract)", () => {
    for (const pack of messagingStarterPacks.packs) {
      expect(pack.language).toBe(pack.locale);
    }
  });

  it("every template body is gated by the 12A variable catalog (no unknowns)", () => {
    for (const pack of messagingStarterPacks.packs) {
      for (const tpl of pack.templates) {
        const result = validateVariables(tpl.bodyTemplate);
        expect(result.unknown).toEqual([]);
        for (const override of tpl.overrides ?? []) {
          if (override.patch.bodyTemplate) {
            const r = validateVariables(override.patch.bodyTemplate);
            expect(r.unknown).toEqual([]);
          }
        }
      }
    }
  });

  it("no shipped template uses internal_only variables", () => {
    const internalOnly = new Set(
      messagingVariables.items
        .filter((i) => i.sendPolicy === "internal_only")
        .map((i) => i.variable),
    );
    for (const pack of messagingStarterPacks.packs) {
      for (const tpl of pack.templates) {
        for (const varName of internalOnly) {
          expect(tpl.bodyTemplate.includes(`{{${varName}}}`)).toBe(false);
        }
      }
    }
  });

  it("sensitive_prearrival variables only appear in mtp.day_of_checkin templates", () => {
    const sensitive = new Set(
      messagingVariables.items
        .filter((i) => i.sendPolicy === "sensitive_prearrival")
        .map((i) => i.variable),
    );
    for (const pack of messagingStarterPacks.packs) {
      for (const tpl of pack.templates) {
        const usesSensitive = Array.from(sensitive).some((v) =>
          tpl.bodyTemplate.includes(`{{${v}}}`),
        );
        if (usesSensitive) {
          expect(tpl.touchpointKey).toBe("mtp.day_of_checkin");
          expect(tpl.automation.triggerType).toBe("day_of_checkin");
          expect(tpl.automation.sendOffsetMinutes).toBeLessThan(0);
          expect(tpl.automation.sendOffsetMinutes).toBeGreaterThanOrEqual(
            -48 * 60,
          );
        }
      }
    }
  });
});

// ── Boot validator — adversarial fixtures ──

describe("messaging_starter_packs.json — Zod validator rejects adversarial fixtures", () => {
  it("rejects sensitive_prearrival token in a non-day_of_checkin touchpoint", () => {
    const fx = baseFixture();
    fx.packs[0].templates[0].bodyTemplate =
      "Hola {{guest_name}}, aquí va: {{wifi_password}}";
    const r = MessagingStarterPacksSchema.safeParse(fx);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) =>
          i.message.includes("mtp.day_of_checkin"),
        ),
      ).toBe(true);
    }
  });

  it("rejects sensitive_prearrival token with wrong triggerType", () => {
    const fx = baseFixture();
    const tpl = fx.packs[0].templates[0];
    tpl.touchpointKey = "mtp.day_of_checkin";
    tpl.bodyTemplate = "Hola {{guest_name}}, wifi: {{wifi_password}}";
    tpl.automation.triggerType = "on_booking_confirmed";
    tpl.automation.sendOffsetMinutes = -120;
    const r = MessagingStarterPacksSchema.safeParse(fx);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message.includes("day_of_checkin")),
      ).toBe(true);
    }
  });

  it("rejects sensitive_prearrival token with sendOffsetMinutes outside [-2880, 0)", () => {
    const fx = baseFixture();
    const tpl = fx.packs[0].templates[0];
    tpl.touchpointKey = "mtp.day_of_checkin";
    tpl.bodyTemplate = "Hola {{guest_name}}, wifi: {{wifi_password}}";
    tpl.automation.triggerType = "day_of_checkin";
    tpl.automation.sendOffsetMinutes = 60;
    const r = MessagingStarterPacksSchema.safeParse(fx);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message.includes("sendOffsetMinutes")),
      ).toBe(true);
    }
  });

  it("rejects an unknown propertyType inside an override", () => {
    const fx = baseFixture();
    fx.packs[0].templates[0].overrides = [
      {
        appliesToPropertyTypes: ["pt.does_not_exist"],
        patch: { bodyTemplate: "Hola {{guest_name}}." },
      },
    ];
    const r = MessagingStarterPacksSchema.safeParse(fx);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message.includes("Unknown propertyType")),
      ).toBe(true);
    }
  });

  it("rejects an unknown variable in body", () => {
    const fx = baseFixture();
    fx.packs[0].templates[0].bodyTemplate = "Hola {{guest_nmae}}";
    const r = MessagingStarterPacksSchema.safeParse(fx);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message.includes("Unknown variable")),
      ).toBe(true);
    }
  });

  it("accepts a sensitive_prearrival body correctly anchored", () => {
    const fx = baseFixture();
    const tpl = fx.packs[0].templates[0];
    tpl.touchpointKey = "mtp.day_of_checkin";
    tpl.bodyTemplate = "Hola {{guest_name}}, wifi: {{wifi_password}}";
    tpl.automation.triggerType = "day_of_checkin";
    tpl.automation.sendOffsetMinutes = -120;
    const r = MessagingStarterPacksSchema.safeParse(fx);
    expect(r.success).toBe(true);
  });
});

// ── listAvailablePacks ──

describe("listAvailablePacks", () => {
  it("returns one summary per pack with templateCount", () => {
    const summaries = listAvailablePacks();
    expect(summaries).toHaveLength(messagingStarterPacks.packs.length);
    for (const s of summaries) {
      const pack = messagingStarterPacks.packs.find((p) => p.id === s.id)!;
      expect(s.templateCount).toBe(pack.templates.length);
      expect(s.locale).toBe(pack.locale);
    }
  });

  it("filters by locale when supplied", () => {
    const es = listAvailablePacks("es");
    expect(es.length).toBeGreaterThan(0);
    for (const s of es) expect(s.locale).toBe("es");
  });
});

// ── applyStarterPack — first-time apply ──

describe("applyStarterPack — first-time apply (empty property)", () => {
  beforeEach(() => {
    prismaMock.property.findUnique.mockResolvedValue(FIXTURE_PROPERTY);
    prismaMock.messageTemplate.findMany.mockResolvedValue([]);
    let nextId = 1;
    prismaMock.messageTemplate.create.mockImplementation(async () => ({
      id: `tpl_${nextId++}`,
    }));
    prismaMock.messageAutomation.create.mockResolvedValue({});
  });

  it("creates N templates + N inactive automations with origin='pack' + packId", async () => {
    const result = await applyStarterPack({
      packId: SHIPPED_PACK.id,
      propertyId: FIXTURE_PROPERTY.id,
    });

    expect(result.packId).toBe(SHIPPED_PACK.id);
    expect(result.templatesCreated).toBe(SHIPPED_PACK.templates.length);
    expect(result.templatesUpdated).toBe(0);
    expect(result.templatesUnchanged).toBe(0);
    expect(result.templatesRemoved).toBe(0);
    expect(result.userOwnedSlotsPreserved).toBe(0);
    expect(result.automationsCreated).toBe(SHIPPED_PACK.templates.length);

    expect(prismaMock.messageTemplate.create).toHaveBeenCalledTimes(
      SHIPPED_PACK.templates.length,
    );
    for (const call of prismaMock.messageTemplate.create.mock.calls) {
      expect(call[0].data.origin).toBe("pack");
      expect(call[0].data.packId).toBe(SHIPPED_PACK.id);
      expect(call[0].data.status).toBe("draft");
    }

    expect(prismaMock.messageTemplate.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.messageAutomation.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.messageTemplate.update).not.toHaveBeenCalled();
  });

  it("throws when the pack id is unknown", async () => {
    await expect(
      applyStarterPack({
        packId: "msp.does_not_exist",
        propertyId: FIXTURE_PROPERTY.id,
      }),
    ).rejects.toThrow(/Unknown starter pack/);
  });

  it("throws when the property is not found", async () => {
    prismaMock.property.findUnique.mockResolvedValue(null);
    await expect(
      applyStarterPack({
        packId: SHIPPED_PACK.id,
        propertyId: "p_missing",
      }),
    ).rejects.toThrow(/Unknown property/);
  });

  it("queries existing rows for both origin=user and origin=pack (never user only)", async () => {
    await applyStarterPack({
      packId: SHIPPED_PACK.id,
      propertyId: FIXTURE_PROPERTY.id,
    });
    const call = prismaMock.messageTemplate.findMany.mock.calls[0][0];
    expect(call.where.propertyId).toBe(FIXTURE_PROPERTY.id);
    expect(call.where.origin).toEqual({ in: ["user", "pack"] });
  });
});

// ── Re-apply same pack: effective no-op ──

describe("applyStarterPack — re-apply same pack is effectively a no-op", () => {
  beforeEach(() => {
    prismaMock.property.findUnique.mockResolvedValue(FIXTURE_PROPERTY);
    prismaMock.messageTemplate.create.mockResolvedValue({ id: "tpl_new" });
    prismaMock.messageAutomation.create.mockResolvedValue({});
    prismaMock.messageTemplate.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.messageAutomation.deleteMany.mockResolvedValue({ count: 0 });
  });

  it("no writes when every slot + content + automation is already in sync", async () => {
    const existing = rowsFromPack(SHIPPED_PACK);
    prismaMock.messageTemplate.findMany.mockResolvedValue(existing);

    prismaMock.messageAutomation.findFirst.mockImplementation(
      async ({ where }: { where: { templateId: string } }) => {
        const i = existing.findIndex((r) => r.id === where.templateId);
        if (i < 0) return null;
        const a = SHIPPED_PACK.templates[i].automation;
        return {
          id: `auto_${i}`,
          triggerType: a.triggerType,
          sendOffsetMinutes: a.sendOffsetMinutes,
        };
      },
    );

    const result = await applyStarterPack({
      packId: SHIPPED_PACK.id,
      propertyId: FIXTURE_PROPERTY.id,
    });

    expect(result.templatesCreated).toBe(0);
    expect(result.templatesUpdated).toBe(0);
    expect(result.templatesUnchanged).toBe(SHIPPED_PACK.templates.length);
    expect(result.templatesRemoved).toBe(0);
    expect(result.userOwnedSlotsPreserved).toBe(0);
    expect(result.automationsCreated).toBe(0);
    expect(result.automationsUpdated).toBe(0);

    expect(prismaMock.messageTemplate.create).not.toHaveBeenCalled();
    expect(prismaMock.messageTemplate.update).not.toHaveBeenCalled();
    expect(prismaMock.messageTemplate.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.messageAutomation.create).not.toHaveBeenCalled();
    expect(prismaMock.messageAutomation.update).not.toHaveBeenCalled();
    expect(prismaMock.messageAutomation.deleteMany).not.toHaveBeenCalled();
  });

  it("updates only the row whose body/subject drifted from the taxonomy", async () => {
    const existing = rowsFromPack(SHIPPED_PACK);
    existing[0].bodyMd = "drifted body — needs refresh";
    prismaMock.messageTemplate.findMany.mockResolvedValue(existing);
    prismaMock.messageAutomation.findFirst.mockImplementation(
      async ({ where }: { where: { templateId: string } }) => {
        const i = existing.findIndex((r) => r.id === where.templateId);
        if (i < 0) return null;
        const a = SHIPPED_PACK.templates[i].automation;
        return {
          id: `auto_${i}`,
          triggerType: a.triggerType,
          sendOffsetMinutes: a.sendOffsetMinutes,
        };
      },
    );

    const result = await applyStarterPack({
      packId: SHIPPED_PACK.id,
      propertyId: FIXTURE_PROPERTY.id,
    });

    expect(result.templatesUpdated).toBe(1);
    expect(result.templatesUnchanged).toBe(SHIPPED_PACK.templates.length - 1);
    expect(result.templatesCreated).toBe(0);
    expect(prismaMock.messageTemplate.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.messageTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existing[0].id },
        data: expect.objectContaining({
          bodyMd: SHIPPED_PACK.templates[0].bodyTemplate,
        }),
      }),
    );
  });
});

// ── User-edited row must not be duplicated / overwritten ──

describe("applyStarterPack — host-edited slot (origin='user') is preserved", () => {
  beforeEach(() => {
    prismaMock.property.findUnique.mockResolvedValue(FIXTURE_PROPERTY);
    prismaMock.messageTemplate.create.mockResolvedValue({ id: "tpl_new" });
    prismaMock.messageTemplate.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.messageAutomation.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.messageAutomation.create.mockResolvedValue({});
  });

  it("never creates a competing pack row when a user row exists for the same slot", async () => {
    const [firstTpl, ...rest] = SHIPPED_PACK.templates;
    const existing = [
      {
        id: "tpl_user_edited",
        touchpointKey: firstTpl.touchpointKey,
        channelKey: firstTpl.channelKey,
        language: SHIPPED_PACK.language,
        origin: "user" as const,
        packId: null,
        subjectLine: "host subject",
        bodyMd: "host-edited body",
      },
      ...rest.map((tpl, i) => ({
        id: `tpl_pack_${i}`,
        touchpointKey: tpl.touchpointKey,
        channelKey: tpl.channelKey,
        language: SHIPPED_PACK.language,
        origin: "pack" as const,
        packId: SHIPPED_PACK.id,
        subjectLine: tpl.subjectLine ?? null,
        bodyMd: tpl.bodyTemplate,
      })),
    ];
    prismaMock.messageTemplate.findMany.mockResolvedValue(existing);
    prismaMock.messageAutomation.findFirst.mockImplementation(
      async ({ where }: { where: { templateId: string } }) => {
        const i = existing.findIndex((r) => r.id === where.templateId);
        if (i <= 0) return null; // user row has no pack automation expected
        const tpl = SHIPPED_PACK.templates[i];
        return {
          id: `auto_${i}`,
          triggerType: tpl.automation.triggerType,
          sendOffsetMinutes: tpl.automation.sendOffsetMinutes,
        };
      },
    );

    const result = await applyStarterPack({
      packId: SHIPPED_PACK.id,
      propertyId: FIXTURE_PROPERTY.id,
    });

    expect(result.userOwnedSlotsPreserved).toBe(1);
    expect(result.templatesCreated).toBe(0);
    expect(result.templatesUpdated).toBe(0);

    for (const call of prismaMock.messageTemplate.create.mock.calls) {
      expect(call[0].data.touchpointKey).not.toBe(firstTpl.touchpointKey);
    }
    for (const call of prismaMock.messageTemplate.update.mock.calls) {
      expect(call[0].where.id).not.toBe("tpl_user_edited");
    }
  });
});

// ── Swap to a different pack ──

describe("applyStarterPack — swap to a different pack", () => {
  beforeEach(() => {
    prismaMock.property.findUnique.mockResolvedValue(FIXTURE_PROPERTY);
    let nextId = 500;
    prismaMock.messageTemplate.create.mockImplementation(async () => ({
      id: `tpl_new_${nextId++}`,
    }));
    prismaMock.messageAutomation.create.mockResolvedValue({});
    prismaMock.messageAutomation.findFirst.mockResolvedValue(null);
  });

  it("updates overlapping slots in place and removes obsolete pack rows — never touches user rows", async () => {
    const priorPackRows = rowsFromPack(SHIPPED_PACK, {
      idPrefix: "tpl_prior_",
      packId: SHIPPED_PACK.id,
    });
    const userRow = {
      id: "tpl_user_owned",
      touchpointKey: "mtp.fake_only_in_no_pack",
      channelKey: "email",
      language: "es",
      origin: "user" as const,
      packId: null,
      subjectLine: "user subj",
      bodyMd: "user-only content",
    };

    prismaMock.messageTemplate.findMany.mockResolvedValue([
      ...priorPackRows,
      userRow,
    ]);
    prismaMock.messageAutomation.findFirst.mockImplementation(
      async ({ where }: { where: { templateId: string } }) => {
        const row = priorPackRows.find((r) => r.id === where.templateId);
        if (!row) return null;
        const i = priorPackRows.indexOf(row);
        const a = SHIPPED_PACK.templates[i].automation;
        return {
          id: `auto_prior_${i}`,
          triggerType: a.triggerType,
          sendOffsetMinutes: a.sendOffsetMinutes,
        };
      },
    );
    prismaMock.messageTemplate.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.messageAutomation.deleteMany.mockResolvedValue({ count: 0 });

    // Slots produced by OTHER_PACK that overlap with SHIPPED_PACK via
    // (touchpointKey, channelKey, language) get UPDATEd; slots only in
    // SHIPPED_PACK get REMOVEd; slots only in OTHER_PACK get CREATEd.
    const shippedSlots = new Set(
      SHIPPED_PACK.templates.map(
        (t) => `${t.touchpointKey}|${t.channelKey}|${SHIPPED_PACK.language}`,
      ),
    );
    const otherSlots = new Set(
      OTHER_PACK.templates.map(
        (t) => `${t.touchpointKey}|${t.channelKey}|${OTHER_PACK.language}`,
      ),
    );
    const overlap = [...shippedSlots].filter((s) => otherSlots.has(s)).length;
    const obsolete = [...shippedSlots].filter((s) => !otherSlots.has(s)).length;
    const fresh = [...otherSlots].filter((s) => !shippedSlots.has(s)).length;

    const result = await applyStarterPack({
      packId: OTHER_PACK.id,
      propertyId: FIXTURE_PROPERTY.id,
    });

    expect(result.packId).toBe(OTHER_PACK.id);
    expect(result.userOwnedSlotsPreserved).toBe(0); // user row has non-overlapping slot, left alone
    expect(result.templatesCreated).toBe(fresh);
    expect(result.templatesRemoved).toBe(obsolete);
    // The overlap can be either updated (if content differs) or unchanged
    // (if packs happen to ship identical copy). Together they cover all
    // overlap slots.
    expect(result.templatesUpdated + result.templatesUnchanged).toBe(overlap);

    // The user row is never deleted — its slot doesn't appear in the new
    // pack's produced set but it is not origin="pack", so it stays.
    if (prismaMock.messageTemplate.deleteMany.mock.calls.length > 0) {
      const deletedIds =
        prismaMock.messageTemplate.deleteMany.mock.calls[0][0].where.id.in;
      expect(deletedIds).not.toContain(userRow.id);
    }

    // Every update/create references OTHER_PACK.id as packId.
    for (const call of prismaMock.messageTemplate.update.mock.calls) {
      expect(call[0].data.packId).toBe(OTHER_PACK.id);
    }
    for (const call of prismaMock.messageTemplate.create.mock.calls) {
      expect(call[0].data.packId).toBe(OTHER_PACK.id);
    }
  });
});

// ── PropertyType override selection ──

describe("applyStarterPack — propertyType override selection", () => {
  beforeEach(() => {
    prismaMock.messageTemplate.findMany.mockResolvedValue([]);
    let nextId = 1;
    prismaMock.messageTemplate.create.mockImplementation(async () => ({
      id: `tpl_${nextId++}`,
    }));
    prismaMock.messageAutomation.create.mockResolvedValue({});
    prismaMock.messageAutomation.findFirst.mockResolvedValue(null);
  });

  it("picks matching override when propertyType matches", async () => {
    const packWithOverride = messagingStarterPacks.packs.find((p) =>
      p.templates.some((t) => t.overrides && t.overrides.length > 0),
    );
    if (!packWithOverride) return;

    const tplWithOverride = packWithOverride.templates.find(
      (t) => t.overrides && t.overrides.length > 0,
    )!;
    const overrideType = tplWithOverride.overrides![0].appliesToPropertyTypes[0];

    prismaMock.property.findUnique.mockResolvedValue({
      ...FIXTURE_PROPERTY,
      propertyType: overrideType,
    });

    await applyStarterPack({
      packId: packWithOverride.id,
      propertyId: FIXTURE_PROPERTY.id,
    });

    const overriddenPatch = tplWithOverride.overrides![0].patch;
    if (overriddenPatch.bodyTemplate) {
      const createCalls = prismaMock.messageTemplate.create.mock.calls;
      const overriddenCall = createCalls.find(
        (c) => c[0].data.touchpointKey === tplWithOverride.touchpointKey,
      );
      expect(overriddenCall).toBeDefined();
      expect(overriddenCall![0].data.bodyMd).toBe(overriddenPatch.bodyTemplate);
    }
  });

  it("uses base body when propertyType is null (no overrides applied)", async () => {
    prismaMock.property.findUnique.mockResolvedValue({
      ...FIXTURE_PROPERTY,
      propertyType: null,
    });

    await applyStarterPack({
      packId: SHIPPED_PACK.id,
      propertyId: FIXTURE_PROPERTY.id,
    });

    const createCalls = prismaMock.messageTemplate.create.mock.calls;
    for (const [, tpl] of SHIPPED_PACK.templates.entries()) {
      const call = createCalls.find(
        (c) => c[0].data.touchpointKey === tpl.touchpointKey,
      );
      expect(call).toBeDefined();
      expect(call![0].data.bodyMd).toBe(tpl.bodyTemplate);
    }
  });
});

// ── previewPack ──

describe("previewPack", () => {
  it("resolves each template in the pack under the property propertyType", async () => {
    prismaMock.property.findUnique.mockResolvedValue({
      id: FIXTURE_PROPERTY.id,
      propertyType: FIXTURE_PROPERTY.propertyType,
    });

    const preview = await previewPack(SHIPPED_PACK.id, FIXTURE_PROPERTY.id);
    expect(preview.pack.id).toBe(SHIPPED_PACK.id);
    expect(preview.templates).toHaveLength(SHIPPED_PACK.templates.length);
    expect(preview.propertyType).toBe(FIXTURE_PROPERTY.propertyType);
    for (const tpl of preview.templates) {
      expect(tpl.bodyResolved).toBeDefined();
      expect(tpl.automation).toBeDefined();
      expect(tpl.resolution).toMatchObject({
        resolved: expect.any(Number),
        missing: expect.any(Number),
        unknown: expect.any(Number),
      });
    }
  });

  it("throws when the pack is unknown", async () => {
    await expect(
      previewPack("msp.does_not_exist", FIXTURE_PROPERTY.id),
    ).rejects.toThrow(/Unknown starter pack/);
  });
});
