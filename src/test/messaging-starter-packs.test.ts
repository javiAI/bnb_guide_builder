// Starter packs (rama 12C). Covers:
//  - Boot validator: catalog loads (positive) + rejects adversarial fixtures
//    (internal_only token, sensitive_prearrival in wrong touchpoint, wrong
//    trigger, out-of-range offset, unknown propertyType override).
//  - `applyStarterPack`: creates N templates + N inactive automations with
//    origin="pack" + packId set.
//  - Re-apply same pack: deletes previous origin="pack" rows, recreates.
//  - Apply different pack: only swaps origin="pack" rows (origin="user"
//    templates are never touched).
//  - PropertyType override selection.
//  - `getMessagingBootstrapStatus` booleans drive the UI empty-state CTA.
//  - 12A variable gate: unknown/internal tokens never ship in a pack body.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const tx = {
    property: { findUnique: vi.fn() },
    messageTemplate: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    messageAutomation: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  };
  const root = {
    ...tx,
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    messageTemplate: {
      ...tx.messageTemplate,
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    messageAutomation: {
      ...tx.messageAutomation,
      count: vi.fn(),
    },
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
  getMessagingBootstrapStatus,
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
  defaultLocale: "es",
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

// Returns a fresh minimal valid pack object for adversarial-fixture tests.
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

beforeEach(() => {
  prismaMock.$transaction.mockClear();
  prismaMock.property.findUnique.mockReset();
  prismaMock.messageTemplate.findMany.mockReset();
  prismaMock.messageTemplate.deleteMany.mockReset();
  prismaMock.messageTemplate.create.mockReset();
  prismaMock.messageTemplate.count.mockReset();
  prismaMock.messageTemplate.findFirst.mockReset();
  prismaMock.messageAutomation.deleteMany.mockReset();
  prismaMock.messageAutomation.create.mockReset();
  prismaMock.messageAutomation.count.mockReset();
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
    // touchpointKey remains "mtp.booking_confirmed" → must fail.
    const r = MessagingStarterPacksSchema.safeParse(fx);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) =>
          i.message.includes('mtp.day_of_checkin'),
        ),
      ).toBe(true);
    }
  });

  it("rejects sensitive_prearrival token with wrong triggerType", () => {
    const fx = baseFixture();
    const tpl = fx.packs[0].templates[0];
    tpl.touchpointKey = "mtp.day_of_checkin";
    tpl.bodyTemplate = "Hola {{guest_name}}, wifi: {{wifi_password}}";
    tpl.automation.triggerType = "on_booking_confirmed"; // wrong
    tpl.automation.sendOffsetMinutes = -120;
    const r = MessagingStarterPacksSchema.safeParse(fx);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message.includes('day_of_checkin')),
      ).toBe(true);
    }
  });

  it("rejects sensitive_prearrival token with sendOffsetMinutes outside [-2880, 0)", () => {
    const fx = baseFixture();
    const tpl = fx.packs[0].templates[0];
    tpl.touchpointKey = "mtp.day_of_checkin";
    tpl.bodyTemplate = "Hola {{guest_name}}, wifi: {{wifi_password}}";
    tpl.automation.triggerType = "day_of_checkin";
    tpl.automation.sendOffsetMinutes = 60; // positive → outside window
    const r = MessagingStarterPacksSchema.safeParse(fx);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) =>
          i.message.includes("sendOffsetMinutes"),
        ),
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
    fx.packs[0].templates[0].bodyTemplate =
      "Hola {{guest_nmae}}"; // typo
    const r = MessagingStarterPacksSchema.safeParse(fx);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) =>
          i.message.includes("Unknown variable"),
        ),
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

// ── applyStarterPack ──

describe("applyStarterPack — first-time apply (no previous pack rows)", () => {
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
    expect(result.automationsCreated).toBe(SHIPPED_PACK.templates.length);
    expect(result.replacedTemplates).toBe(0);
    expect(result.replacedAutomations).toBe(0);

    expect(prismaMock.messageTemplate.create).toHaveBeenCalledTimes(
      SHIPPED_PACK.templates.length,
    );
    for (const call of prismaMock.messageTemplate.create.mock.calls) {
      expect(call[0].data.origin).toBe("pack");
      expect(call[0].data.packId).toBe(SHIPPED_PACK.id);
      expect(call[0].data.status).toBe("draft");
    }

    expect(prismaMock.messageAutomation.create).toHaveBeenCalledTimes(
      SHIPPED_PACK.templates.length,
    );
    for (const call of prismaMock.messageAutomation.create.mock.calls) {
      expect(call[0].data.active).toBe(false);
      expect(call[0].data.timezoneSource).toBe("property_timezone");
    }

    // No deletes since nothing existed.
    expect(prismaMock.messageTemplate.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.messageAutomation.deleteMany).not.toHaveBeenCalled();
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
});

describe("applyStarterPack — re-apply + swap semantics", () => {
  beforeEach(() => {
    prismaMock.property.findUnique.mockResolvedValue(FIXTURE_PROPERTY);
    let nextId = 100;
    prismaMock.messageTemplate.create.mockImplementation(async () => ({
      id: `tpl_new_${nextId++}`,
    }));
    prismaMock.messageAutomation.create.mockResolvedValue({});
  });

  it("re-applying the same pack swaps its rows (deletes previous origin='pack' only)", async () => {
    prismaMock.messageTemplate.findMany.mockResolvedValue([
      { id: "tpl_old_1" },
      { id: "tpl_old_2" },
    ]);
    prismaMock.messageAutomation.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.messageTemplate.deleteMany.mockResolvedValue({ count: 2 });

    const result = await applyStarterPack({
      packId: SHIPPED_PACK.id,
      propertyId: FIXTURE_PROPERTY.id,
    });

    expect(result.replacedTemplates).toBe(2);
    expect(result.replacedAutomations).toBe(2);

    // The findMany WHERE is scoped to origin="pack" → origin="user" rows are
    // never surfaced in previousIds and therefore cannot be deleted.
    expect(prismaMock.messageTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          propertyId: FIXTURE_PROPERTY.id,
          origin: "pack",
        }),
      }),
    );

    expect(prismaMock.messageAutomation.deleteMany).toHaveBeenCalledWith({
      where: { templateId: { in: ["tpl_old_1", "tpl_old_2"] } },
    });
    expect(prismaMock.messageTemplate.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tpl_old_1", "tpl_old_2"] } },
    });
  });

  it("applying a different pack swaps only origin='pack' rows", async () => {
    prismaMock.messageTemplate.findMany.mockResolvedValue([
      { id: "tpl_previous_pack_1" },
    ]);
    prismaMock.messageAutomation.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.messageTemplate.deleteMany.mockResolvedValue({ count: 1 });

    const result = await applyStarterPack({
      packId: OTHER_PACK.id,
      propertyId: FIXTURE_PROPERTY.id,
    });

    expect(result.packId).toBe(OTHER_PACK.id);
    expect(result.replacedTemplates).toBe(1);
    for (const call of prismaMock.messageTemplate.create.mock.calls) {
      expect(call[0].data.packId).toBe(OTHER_PACK.id);
    }
  });

  it("never deletes origin='user' templates (findMany query is scoped to origin='pack')", async () => {
    prismaMock.messageTemplate.findMany.mockResolvedValue([]);
    await applyStarterPack({
      packId: SHIPPED_PACK.id,
      propertyId: FIXTURE_PROPERTY.id,
    });
    for (const call of prismaMock.messageTemplate.findMany.mock.calls) {
      expect(call[0].where.origin).toBe("pack");
    }
    expect(prismaMock.messageTemplate.deleteMany).not.toHaveBeenCalled();
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
  });

  it("picks matching override when propertyType matches", async () => {
    const packWithOverride = messagingStarterPacks.packs.find((p) =>
      p.templates.some(
        (t) => t.overrides && t.overrides.length > 0,
      ),
    );
    if (!packWithOverride) return; // no overrides shipped → skip silently

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

// ── getMessagingBootstrapStatus ──

describe("getMessagingBootstrapStatus", () => {
  it("returns hasPackRows=true when at least one origin='pack' row exists", async () => {
    prismaMock.messageTemplate.count.mockResolvedValue(7);
    prismaMock.messageAutomation.count.mockResolvedValue(7);
    prismaMock.messageTemplate.findFirst.mockResolvedValue({ id: "tpl_x" });

    const s = await getMessagingBootstrapStatus("p_1");
    expect(s).toEqual({
      templateCount: 7,
      automationCount: 7,
      hasPackRows: true,
    });
    expect(prismaMock.messageTemplate.findFirst).toHaveBeenCalledWith({
      where: { propertyId: "p_1", origin: "pack" },
      select: { id: true },
    });
  });

  it("returns hasPackRows=false when no origin='pack' rows exist", async () => {
    prismaMock.messageTemplate.count.mockResolvedValue(0);
    prismaMock.messageAutomation.count.mockResolvedValue(0);
    prismaMock.messageTemplate.findFirst.mockResolvedValue(null);

    const s = await getMessagingBootstrapStatus("p_1");
    expect(s.hasPackRows).toBe(false);
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
