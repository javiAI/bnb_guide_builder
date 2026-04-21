// Starter packs: pre-built templates + inactive automations grouped by
// `(tone × locale)`. Idempotency hinges on `origin = "pack"`: re-apply drops
// only pack-owned rows, leaving `origin = "user"` (host-edited) untouched.

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import {
  messagingStarterPacks,
  findMessagingStarterPack,
  type MessagingStarterPack,
  type MessagingStarterPackTemplate,
  type MessagingStarterPackOverride,
  type MessagingStarterPackLocale,
} from "@/lib/taxonomy-loader";
import {
  resolveVariables,
  type ResolutionResult,
} from "@/lib/services/messaging-variables.service";
import { ORIGIN_PACK, ORIGIN_USER } from "@/lib/services/messaging-shared";

type Db = PrismaClient | Prisma.TransactionClient;

export interface StarterPackSummary {
  id: string;
  name: string;
  tone: MessagingStarterPack["tone"];
  locale: MessagingStarterPackLocale;
  language: MessagingStarterPackLocale;
  description: string;
  templateCount: number;
}

export interface StarterPackTemplatePreview {
  touchpointKey: string;
  channelKey: string;
  subjectLine: string | null;
  bodyTemplate: string;
  bodyResolved: string;
  appliedOverridePropertyTypes: string[] | null;
  automation: {
    triggerType: string;
    sendOffsetMinutes: number;
  };
  resolution: {
    states: ResolutionResult["states"];
    resolved: number;
    missing: number;
    unknown: number;
    unresolvedContext: number;
  };
}

export interface StarterPackPreview {
  pack: StarterPackSummary;
  propertyType: string | null;
  templates: StarterPackTemplatePreview[];
}

export interface ApplyStarterPackResult {
  packId: string;
  templatesCreated: number;
  templatesUpdated: number;
  templatesUnchanged: number;
  templatesRemoved: number;
  userOwnedSlotsPreserved: number;
  automationsCreated: number;
  automationsUpdated: number;
  automationsRemoved: number;
}

function summarise(pack: MessagingStarterPack): StarterPackSummary {
  return {
    id: pack.id,
    name: pack.name,
    tone: pack.tone,
    locale: pack.locale,
    language: pack.language,
    description: pack.description,
    templateCount: pack.templates.length,
  };
}

export function listAvailablePacks(
  locale?: MessagingStarterPackLocale,
): StarterPackSummary[] {
  const packs = locale
    ? messagingStarterPacks.packs.filter((p) => p.locale === locale)
    : messagingStarterPacks.packs;
  return packs.map(summarise);
}

function pickOverride(
  tpl: MessagingStarterPackTemplate,
  propertyType: string | null,
): MessagingStarterPackOverride | null {
  if (!propertyType || !tpl.overrides) return null;
  for (const override of tpl.overrides) {
    if (override.appliesToPropertyTypes.includes(propertyType)) {
      return override;
    }
  }
  return null;
}

interface ResolvedTemplate {
  touchpointKey: string;
  channelKey: string;
  subjectLine: string | null;
  bodyTemplate: string;
  appliedOverridePropertyTypes: string[] | null;
  automation: MessagingStarterPackTemplate["automation"];
}

function resolveTemplateForPropertyType(
  tpl: MessagingStarterPackTemplate,
  propertyType: string | null,
): ResolvedTemplate {
  const override = pickOverride(tpl, propertyType);
  return {
    touchpointKey: tpl.touchpointKey,
    channelKey: tpl.channelKey,
    subjectLine: override?.patch.subjectLine ?? tpl.subjectLine ?? null,
    bodyTemplate: override?.patch.bodyTemplate ?? tpl.bodyTemplate,
    appliedOverridePropertyTypes: override?.appliesToPropertyTypes ?? null,
    automation: tpl.automation,
  };
}

export async function previewPack(
  packId: string,
  propertyId: string,
  db: Db = defaultPrisma,
): Promise<StarterPackPreview> {
  const pack = findMessagingStarterPack(packId);
  if (!pack) {
    throw new Error(`Unknown starter pack "${packId}"`);
  }

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, propertyType: true },
  });
  if (!property) {
    throw new Error(`Unknown property "${propertyId}"`);
  }

  const resolved = pack.templates.map((tpl) =>
    resolveTemplateForPropertyType(tpl, property.propertyType),
  );

  const resolutions = await Promise.all(
    resolved.map((tpl) => resolveVariables(propertyId, tpl.bodyTemplate)),
  );

  const previews: StarterPackTemplatePreview[] = resolved.map((tpl, i) => {
    const resolution = resolutions[i];
    return {
      touchpointKey: tpl.touchpointKey,
      channelKey: tpl.channelKey,
      subjectLine: tpl.subjectLine,
      bodyTemplate: tpl.bodyTemplate,
      bodyResolved: resolution.output,
      appliedOverridePropertyTypes: tpl.appliedOverridePropertyTypes,
      automation: tpl.automation,
      resolution: {
        states: resolution.states,
        resolved: resolution.resolved.length,
        missing: resolution.missing.length,
        unknown: resolution.unknown.length,
        unresolvedContext: resolution.unresolvedContext.length,
      },
    };
  });

  return {
    pack: summarise(pack),
    propertyType: property.propertyType,
    templates: previews,
  };
}

// Equivalence key for "same slot" — a pack must never compete with a user row,
// nor duplicate an existing pack row, for the same (touchpoint, channel, language).
// `channelKey` is nullable at the DB layer; legacy rows without a channel share
// a distinct slot from any pack template (which always carries a channelKey).
function slotKey(parts: {
  touchpointKey: string;
  channelKey: string | null;
  language: string;
}): string {
  return `${parts.touchpointKey}|${parts.channelKey ?? ""}|${parts.language}`;
}

export async function applyStarterPack(params: {
  packId: string;
  propertyId: string;
  db?: Db;
}): Promise<ApplyStarterPackResult> {
  const { packId, propertyId } = params;
  const pack = findMessagingStarterPack(packId);
  if (!pack) {
    throw new Error(`Unknown starter pack "${packId}"`);
  }

  const runner = params.db ?? defaultPrisma;

  const run = async (tx: Db): Promise<ApplyStarterPackResult> => {
    const property = await tx.property.findUnique({
      where: { id: propertyId },
      select: { id: true, propertyType: true },
    });
    if (!property) {
      throw new Error(`Unknown property "${propertyId}"`);
    }

    const existing = await tx.messageTemplate.findMany({
      where: { propertyId, origin: { in: [ORIGIN_USER, ORIGIN_PACK] } },
      select: {
        id: true,
        touchpointKey: true,
        channelKey: true,
        language: true,
        origin: true,
        packId: true,
        subjectLine: true,
        bodyMd: true,
      },
    });

    const existingBySlot = new Map<string, (typeof existing)[number]>();
    for (const row of existing) {
      existingBySlot.set(slotKey(row), row);
    }

    const producedSlots = new Set<string>();
    let templatesCreated = 0;
    let templatesUpdated = 0;
    let templatesUnchanged = 0;
    let userOwnedSlotsPreserved = 0;
    let automationsCreated = 0;
    let automationsUpdated = 0;

    for (const tpl of pack.templates) {
      const resolved = resolveTemplateForPropertyType(
        tpl,
        property.propertyType,
      );
      const key = slotKey({
        touchpointKey: resolved.touchpointKey,
        channelKey: resolved.channelKey,
        language: pack.language,
      });
      producedSlots.add(key);

      const current = existingBySlot.get(key);

      // Host owns this slot — never create a competing pack row.
      if (current?.origin === ORIGIN_USER) {
        userOwnedSlotsPreserved += 1;
        continue;
      }

      if (current?.origin === ORIGIN_PACK) {
        const contentStable =
          current.packId === pack.id &&
          current.subjectLine === resolved.subjectLine &&
          current.bodyMd === resolved.bodyTemplate;

        const currentAutomation = await tx.messageAutomation.findFirst({
          where: { templateId: current.id },
          select: { id: true, triggerType: true, sendOffsetMinutes: true },
        });
        const automationStable =
          !!currentAutomation &&
          currentAutomation.triggerType === resolved.automation.triggerType &&
          currentAutomation.sendOffsetMinutes ===
            resolved.automation.sendOffsetMinutes;

        if (contentStable && automationStable) {
          templatesUnchanged += 1;
          continue;
        }

        if (!contentStable) {
          await tx.messageTemplate.update({
            where: { id: current.id },
            data: {
              subjectLine: resolved.subjectLine,
              bodyMd: resolved.bodyTemplate,
              language: pack.language,
              packId: pack.id,
            },
          });
          templatesUpdated += 1;
        }

        if (currentAutomation) {
          if (!automationStable) {
            await tx.messageAutomation.update({
              where: { id: currentAutomation.id },
              data: {
                triggerType: resolved.automation.triggerType,
                sendOffsetMinutes: resolved.automation.sendOffsetMinutes,
              },
            });
            automationsUpdated += 1;
          }
        } else {
          await tx.messageAutomation.create({
            data: {
              propertyId,
              touchpointKey: resolved.touchpointKey,
              templateId: current.id,
              channelKey: resolved.channelKey,
              active: false,
              triggerType: resolved.automation.triggerType,
              sendOffsetMinutes: resolved.automation.sendOffsetMinutes,
              timezoneSource: "property_timezone",
            },
          });
          automationsCreated += 1;
        }
        continue;
      }

      const created = await tx.messageTemplate.create({
        data: {
          propertyId,
          touchpointKey: resolved.touchpointKey,
          channelKey: resolved.channelKey,
          subjectLine: resolved.subjectLine,
          bodyMd: resolved.bodyTemplate,
          language: pack.language,
          status: "draft",
          origin: ORIGIN_PACK,
          packId: pack.id,
        },
        select: { id: true },
      });
      templatesCreated += 1;

      await tx.messageAutomation.create({
        data: {
          propertyId,
          touchpointKey: resolved.touchpointKey,
          templateId: created.id,
          channelKey: resolved.channelKey,
          active: false,
          triggerType: resolved.automation.triggerType,
          sendOffsetMinutes: resolved.automation.sendOffsetMinutes,
          timezoneSource: "property_timezone",
        },
      });
      automationsCreated += 1;
    }

    // Pack-owned rows from a prior pack whose slot is not produced by the new
    // one are left-overs and must be dropped. User rows are never touched.
    const obsoletePackIds = existing
      .filter(
        (row) => row.origin === ORIGIN_PACK && !producedSlots.has(slotKey(row)),
      )
      .map((row) => row.id);

    let templatesRemoved = 0;
    let automationsRemoved = 0;
    if (obsoletePackIds.length > 0) {
      const { count: acount } = await tx.messageAutomation.deleteMany({
        where: { templateId: { in: obsoletePackIds } },
      });
      automationsRemoved = acount;
      const { count: tcount } = await tx.messageTemplate.deleteMany({
        where: { id: { in: obsoletePackIds } },
      });
      templatesRemoved = tcount;
    }

    return {
      packId: pack.id,
      templatesCreated,
      templatesUpdated,
      templatesUnchanged,
      templatesRemoved,
      userOwnedSlotsPreserved,
      automationsCreated,
      automationsUpdated,
      automationsRemoved,
    };
  };

  if ("$transaction" in runner && typeof runner.$transaction === "function") {
    return runner.$transaction((tx) => run(tx as Db));
  }
  return run(runner);
}
