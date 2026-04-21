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
import { MESSAGE_TEMPLATE_ORIGINS } from "@/lib/services/messaging-shared";

type Db = PrismaClient | Prisma.TransactionClient;

const ORIGIN_PACK: (typeof MESSAGE_TEMPLATE_ORIGINS)[1] = "pack";

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
  automationsCreated: number;
  replacedTemplates: number;
  replacedAutomations: number;
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
      select: { id: true, propertyType: true, defaultLocale: true },
    });
    if (!property) {
      throw new Error(`Unknown property "${propertyId}"`);
    }

    const previousPackTemplates = await tx.messageTemplate.findMany({
      where: { propertyId, origin: ORIGIN_PACK },
      select: { id: true },
    });
    const previousIds = previousPackTemplates.map((t) => t.id);

    let replacedAutomations = 0;
    if (previousIds.length > 0) {
      const { count } = await tx.messageAutomation.deleteMany({
        where: { templateId: { in: previousIds } },
      });
      replacedAutomations = count;
      await tx.messageTemplate.deleteMany({
        where: { id: { in: previousIds } },
      });
    }

    let templatesCreated = 0;
    let automationsCreated = 0;

    for (const tpl of pack.templates) {
      const resolved = resolveTemplateForPropertyType(
        tpl,
        property.propertyType,
      );
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

    return {
      packId: pack.id,
      templatesCreated,
      automationsCreated,
      replacedTemplates: previousIds.length,
      replacedAutomations,
    };
  };

  if ("$transaction" in runner && typeof runner.$transaction === "function") {
    return runner.$transaction((tx) => run(tx as Db));
  }
  return run(runner);
}

export async function getMessagingBootstrapStatus(
  propertyId: string,
  db: Db = defaultPrisma,
): Promise<{ templateCount: number; automationCount: number; hasPackRows: boolean }> {
  const [templateCount, automationCount, hasPackRows] = await Promise.all([
    db.messageTemplate.count({ where: { propertyId } }),
    db.messageAutomation.count({ where: { propertyId } }),
    db.messageTemplate
      .findFirst({
        where: { propertyId, origin: ORIGIN_PACK },
        select: { id: true },
      })
      .then((row) => row !== null),
  ]);
  return { templateCount, automationCount, hasPackRows };
}
