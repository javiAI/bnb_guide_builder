import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import {
  findSystemItem,
  findAmenityItem,
  getSpaceTypeLabel,
  contactTypes,
  propertyTypes,
  accessMethods,
  bedTypes,
} from "@/lib/taxonomy-loader";
import type { ExtractedChunk, ChunkType, EntityType, JourneyStage } from "@/lib/types/knowledge";
import type { VisibilityLevel } from "@prisma/client";
import {
  AUDIENCE_LABELS,
  AUDIENCE_LABELS_EN,
  SENSITIVITY_LABELS,
  SENSITIVITY_LABELS_EN,
} from "@/lib/visibility";
import knowledgeTemplatesRaw from "../../../taxonomies/knowledge_templates.json";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const SECTION_LABELS: Record<EntityType, string> = {
  property: "General",
  access: "Llegada e instrucciones de acceso",
  policy: "Normas y políticas",
  contact: "Contactos",
  amenity: "Equipamiento",
  space: "Espacios",
  system: "Sistemas",
};


const SPANISH_STOPWORDS = new Set([
  "a", "al", "con", "de", "del", "el", "en", "es", "la", "las", "le", "lo",
  "los", "no", "o", "para", "por", "que", "se", "si", "su", "un", "una", "y",
]);

const ENGLISH_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "has", "have", "had", "do", "does", "did", "it", "its", "as", "if",
  "no", "not", "so", "up", "us", "we",
]);

const SECTION_LABELS_EN: Record<EntityType, string> = {
  property: "General",
  access: "Arrival & Access Instructions",
  policy: "Rules & Policies",
  contact: "Contacts",
  amenity: "Amenities",
  space: "Spaces",
  system: "Systems",
};

function getSectionLabels(locale: string): Record<EntityType, string> {
  return locale === "en" ? SECTION_LABELS_EN : SECTION_LABELS;
}

// ──────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────

export function buildContextPrefix(params: {
  propertyName: string;
  city: string | null;
  sectionLabel: string;
  entityLabel: string;
  visibility: VisibilityLevel;
  canonicalQuestion: string;
  locale?: string;
}): string {
  const location = params.city ?? "";
  const locationPart = location ? `, ${location}` : "";
  const isEn = params.locale === "en";
  if (isEn) {
    return [
      `Property: ${params.propertyName}${locationPart}.`,
      `Section: ${params.sectionLabel} > ${params.entityLabel}.`,
      `Intended for: ${AUDIENCE_LABELS_EN[params.visibility] ?? params.visibility}.`,
      `Sensitivity: ${SENSITIVITY_LABELS_EN[params.visibility] ?? "medium"}.`,
      `Question this answers: "${params.canonicalQuestion}"`,
    ].join("\n");
  }
  return [
    `Propiedad: ${params.propertyName}${locationPart}.`,
    `Sección: ${params.sectionLabel} > ${params.entityLabel}.`,
    `Destinado a: ${AUDIENCE_LABELS[params.visibility] ?? params.visibility}.`,
    `Sensibilidad: ${SENSITIVITY_LABELS[params.visibility] ?? "media"}.`,
    `Pregunta que responde: "${params.canonicalQuestion}"`,
  ].join("\n");
}

export function buildBm25Text(contextPrefix: string, bodyMd: string, locale = "es"): string {
  const stopwords = locale === "en" ? ENGLISH_STOPWORDS : SPANISH_STOPWORDS;
  return `${contextPrefix} ${bodyMd}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopwords.has(w))
    .join(" ");
}

export function buildContentHash(contextPrefix: string, bodyMd: string): string {
  return createHash("sha256")
    .update(`${contextPrefix}\n${bodyMd}`)
    .digest("hex")
    .slice(0, 16);
}

// ──────────────────────────────────────────────
// Template renderer (knowledge_templates.json)
// ──────────────────────────────────────────────

type TemplateEntry = {
  topic: string;
  canonicalQuestion: string;
  bodyTemplate: string;
  journeyStage: JourneyStage;
  sourceFields: string[];
};

function interpolate(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  let result = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key: string, content: string) => (vars[key] ? content : ""),
  );
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
  return result.trim();
}

function renderKnowledgeTemplate(
  entityType: string,
  chunkType: string,
  templateId: string,
  locale: string,
  vars: Record<string, string | null | undefined>,
): (Omit<TemplateEntry, "bodyTemplate"> & { bodyMd: string }) | null {
  const templates = (knowledgeTemplatesRaw as { templates: Record<string, Record<string, Record<string, Record<string, TemplateEntry>>>> }).templates;
  const entry = templates[entityType]?.[chunkType]?.[templateId]?.[locale]
    ?? templates[entityType]?.[chunkType]?.[templateId]?.["es"];
  if (!entry) return null;
  return {
    topic: interpolate(entry.topic, vars),
    canonicalQuestion: interpolate(entry.canonicalQuestion, vars),
    bodyMd: interpolate(entry.bodyTemplate, vars),
    journeyStage: entry.journeyStage,
    sourceFields: entry.sourceFields,
  };
}

function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}


type PropertyChunkInput = {
  topic: string;
  bodyMd: string;
  canonicalQuestion?: string | null;
  chunkType: ChunkType;
  entityType: EntityType;
  entityId: string | null;
  visibility?: VisibilityLevel;
  journeyStage: JourneyStage;
  sourceFields: string[];
  tags?: string[];
  templateKey: string;
  validFrom?: Date | null;
  validTo?: Date | null;
};

function makePropertyChunk(
  propertyId: string,
  locale: string,
  propertyName: string,
  city: string | null,
  params: PropertyChunkInput,
): ExtractedChunk {
  const rawVisibility = params.visibility ?? "guest";

  // Invariant: no chunk may have higher visibility than its source entity.
  // Property-level extractors always emit guest visibility.
  assertVisibilityBound("guest", rawVisibility);
  const visibility = toNonSensitiveVisibility(rawVisibility);

  const canonicalQuestion = params.canonicalQuestion ?? params.topic;
  const sectionLabels = getSectionLabels(locale);
  const contextPrefix = buildContextPrefix({
    propertyName,
    city,
    sectionLabel: sectionLabels[params.entityType],
    entityLabel: params.topic,
    visibility,
    canonicalQuestion,
    locale,
  });
  const bm25Text = buildBm25Text(contextPrefix, params.bodyMd, locale);
  const contentHash = buildContentHash(contextPrefix, params.bodyMd);
  return {
    propertyId,
    topic: params.topic,
    bodyMd: params.bodyMd,
    locale,
    visibility,
    confidenceScore: 1.0,
    journeyStage: params.journeyStage,
    chunkType: params.chunkType,
    entityType: params.entityType,
    entityId: params.entityId,
    canonicalQuestion,
    contextPrefix,
    bm25Text,
    tokens: approxTokens(contextPrefix + " " + params.bodyMd),
    sourceFields: params.sourceFields,
    tags: params.tags ?? [],
    contentHash,
    templateKey: params.templateKey,
    validFrom: params.validFrom ?? null,
    validTo: params.validTo ?? null,
  };
}

const VISIBILITY_ORDER: Record<string, number> = {
  guest: 0,
  ai: 1,
  internal: 2,
  sensitive: 3,
};

function assertVisibilityBound(
  sourceLevel: string,
  chunkLevel: string,
): void {
  if (VISIBILITY_ORDER[chunkLevel] > VISIBILITY_ORDER[sourceLevel]) {
    throw new Error(
      `[knowledge-extract] visibility violation: source '${sourceLevel}' produced chunk '${chunkLevel}'`,
    );
  }
}

function toNonSensitiveVisibility(v: VisibilityLevel): Exclude<VisibilityLevel, "sensitive"> {
  if (v === "sensitive") {
    throw new Error(`[knowledge-extract] sensitive visibility may not be extracted into a chunk`);
  }
  return v;
}

// ──────────────────────────────────────────────
// Access sanitization helpers
// ──────────────────────────────────────────────

// Returns only taxonomy-derived labels — never includes customDesc (may contain PINs/codes).
// Falls back to generic label (never raw key) to prevent internal IDs leaking into bodyMd.
function resolveAccessMethodLabels(methods: string[]): string {
  return methods
    .map((m) => accessMethods.items.find((a) => a.id === m)?.label ?? "Método de acceso")
    .join(", ");
}

// Bed-type taxonomy labels are Spanish. For EN extraction, map by id to avoid
// leaking Spanish terms into otherwise-English chunk bodies. Unknown ids fall
// back to a generic label rather than the taxonomy Spanish string.
const BED_TYPE_LABELS_EN: Record<string, string> = {
  double: "Double bed",
  single: "Single bed",
  sofa_bed: "Sofa bed",
  bunk_bed: "Bunk bed",
  queen: "Queen bed",
  king: "King bed",
};

function resolveBedTypeLabel(bedTypeId: string, locale = "es"): string {
  if (locale === "en") {
    return BED_TYPE_LABELS_EN[bedTypeId] ?? "Bed";
  }
  return bedTypes.items.find((b) => b.id === bedTypeId)?.label ?? "Cama";
}

// NOTE: customDesc intentionally excluded from both — may contain PINs or access codes.
function buildSafeAccessDescription(
  access: { methods: string[]; customLabel?: string | null },
  fallback: string,
): string {
  const methodLabels = resolveAccessMethodLabels(access.methods);
  const parts: string[] = [];
  if (access.customLabel) parts.push(access.customLabel);
  if (methodLabels) parts.push(methodLabels);
  return parts.join(" — ") || fallback;
}

// ──────────────────────────────────────────────
// Extractors
// ──────────────────────────────────────────────

export async function extractFromProperty(
  propertyId: string,
  locale = "es",
): Promise<ExtractedChunk[]> {
  const p = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: {
      propertyNickname: true,
      propertyType: true,
      city: true,
      country: true,
      checkInStart: true,
      checkInEnd: true,
      checkOutTime: true,
      maxGuests: true,
      maxAdults: true,
      maxChildren: true,
      infantsAllowed: true,
    },
  });

  const chunks: ExtractedChunk[] = [];
  const name = p.propertyNickname;
  const city = p.city;

  const mk = (
    params: Parameters<typeof makePropertyChunk>[4],
  ) => makePropertyChunk(propertyId, locale, name, city, params);

  const tpl = (templateId: string, vars: Record<string, string | null | undefined>) =>
    renderKnowledgeTemplate("property", "fact", templateId, locale, vars);

  if (p.checkInStart && p.checkInEnd) {
    const t = tpl("checkin_time", {
      propertyName: name,
      checkInStart: p.checkInStart,
      checkInEnd: p.checkInEnd,
    });
    if (t) chunks.push(mk({ ...t, chunkType: "fact", entityType: "property", entityId: null, templateKey: "checkin_time" }));
  }

  if (p.checkOutTime) {
    const t = tpl("checkout_time", { propertyName: name, checkOutTime: p.checkOutTime });
    if (t) chunks.push(mk({ ...t, chunkType: "fact", entityType: "property", entityId: null, templateKey: "checkout_time" }));
  }

  if (p.maxGuests) {
    const t = tpl("capacity", {
      propertyName: name,
      maxGuests: String(p.maxGuests),
      maxAdults: String(p.maxAdults),
      maxChildren: p.maxChildren > 0 ? String(p.maxChildren) : null,
    });
    if (t) chunks.push(mk({ ...t, chunkType: "fact", entityType: "property", entityId: null, templateKey: "capacity" }));
  }

  if (p.propertyType) {
    const typeLabel =
      propertyTypes.items.find((tt) => tt.id === p.propertyType)?.label ?? p.propertyType;
    const t = tpl("overview", {
      propertyName: name,
      propertyTypeLabel: typeLabel,
      city: p.city,
      country: p.country,
    });
    if (t) chunks.push(mk({ ...t, chunkType: "fact", entityType: "property", entityId: null, templateKey: "overview" }));
  }

  return chunks;
}

export async function extractFromAccess(
  propertyId: string,
  locale = "es",
): Promise<ExtractedChunk[]> {
  const p = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: {
      propertyNickname: true,
      city: true,
      checkInStart: true,
      checkInEnd: true,
      checkOutTime: true,
      isAutonomousCheckin: true,
      primaryAccessMethod: true,
      accessMethodsJson: true,
      hasBuildingAccess: true,
    },
  });

  const chunks: ExtractedChunk[] = [];
  const name = p.propertyNickname;
  const city = p.city;

  const access = p.accessMethodsJson as {
    unit?: { methods: string[]; customLabel?: string | null; customDesc?: string | null };
    building?: { methods: string[]; customLabel?: string | null; customDesc?: string | null } | null;
  } | null;

  const mkAccess = (params: Parameters<typeof makePropertyChunk>[4]) =>
    makePropertyChunk(propertyId, locale, name, city, params);

  const tpl = (templateId: string, vars: Record<string, string | null | undefined>) =>
    renderKnowledgeTemplate("access", "procedure", templateId, locale, vars);

  const isEn = locale === "en";

  if (access?.unit?.methods?.length) {
    const accessDescription = buildSafeAccessDescription(
      access.unit,
      isEn ? "Access method available" : "Método de acceso disponible",
    );
    const t = tpl("unit_access", { propertyName: name, accessDescription });
    if (t) chunks.push(mkAccess({ ...t, chunkType: "procedure", entityType: "access", entityId: null, templateKey: "unit_access" }));
  }

  if (p.hasBuildingAccess && access?.building?.methods?.length) {
    const buildingAccessDescription = buildSafeAccessDescription(
      access.building,
      isEn ? "Building access available" : "Acceso al edificio disponible",
    );
    const t = tpl("building_access", { propertyName: name, buildingAccessDescription });
    if (t) chunks.push(mkAccess({ ...t, chunkType: "procedure", entityType: "access", entityId: null, templateKey: "building_access" }));
  }

  if (p.checkInStart && p.checkInEnd && p.checkOutTime) {
    const accessSummary = access?.unit?.methods?.length
      ? buildSafeAccessDescription(access.unit, isEn ? "Access method available" : "Método de acceso disponible")
      : null;
    const autonomousPart = p.isAutonomousCheckin
      ? isEn
        ? "Access is self-check-in; no in-person greeting required."
        : "El acceso es autónomo, sin necesidad de recibimiento en persona."
      : null;
    const accessSummaryLine = accessSummary
      ? isEn
        ? `Access: ${accessSummary}`
        : `Acceso: ${accessSummary}`
      : null;
    const t = tpl("checkin_logistics", {
      propertyName: name,
      checkInStart: p.checkInStart,
      checkInEnd: p.checkInEnd,
      checkOutTime: p.checkOutTime,
      accessSummary: accessSummaryLine,
      autonomousPart,
    });
    if (t) chunks.push(mkAccess({ ...t, chunkType: "procedure", entityType: "access", entityId: null, templateKey: "checkin_logistics" }));
  }

  return chunks;
}

export async function extractFromPolicies(
  propertyId: string,
  locale = "es",
): Promise<ExtractedChunk[]> {
  const p = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: {
      propertyNickname: true,
      city: true,
      policiesJson: true,
      infantsAllowed: true,
      maxChildren: true,
    },
  });

  const chunks: ExtractedChunk[] = [];
  const name = p.propertyNickname;
  const city = p.city;

  let rawPolicies = p.policiesJson;
  if (typeof rawPolicies === "string") {
    try { rawPolicies = JSON.parse(rawPolicies); } catch { return chunks; }
  }
  const pol = rawPolicies as {
    quietHours?: { enabled?: boolean; from?: string; to?: string };
    smoking?: string;
    pets?: { allowed?: boolean; types?: string[]; maxCount?: number; sizeRestriction?: string; notes?: string };
  } | null;

  if (!pol) return chunks;

  const mkPolicy = (params: Parameters<typeof makePropertyChunk>[4]): ExtractedChunk =>
    makePropertyChunk(propertyId, locale, name, city, params);

  const tpl = (templateId: string, vars: Record<string, string | null | undefined>) =>
    renderKnowledgeTemplate("policy", "policy", templateId, locale, vars);

  const isEn = locale === "en";

  if (pol.smoking) {
    const smokingLabelsEs: Record<string, string> = {
      not_allowed: "No se permite fumar en ningún lugar del alojamiento.",
      outdoors_only: "Solo se permite fumar en zonas exteriores.",
      designated_area: "Hay una zona habilitada para fumadores.",
      no_restriction: "No hay restricciones para fumar.",
    };
    const smokingLabelsEn: Record<string, string> = {
      not_allowed: "Smoking is not permitted anywhere on the property.",
      outdoors_only: "Smoking is only permitted in outdoor areas.",
      designated_area: "There is a designated smoking area.",
      no_restriction: "There are no smoking restrictions.",
    };
    const labels = isEn ? smokingLabelsEn : smokingLabelsEs;
    const smokingPolicyText =
      labels[pol.smoking] ??
      (isEn ? `Smoking policy: ${pol.smoking}.` : `Política de fumadores: ${pol.smoking}.`);
    const t = tpl("smoking", { smokingPolicyText });
    if (t) chunks.push(mkPolicy({ ...t, chunkType: "policy", entityType: "policy", entityId: null, templateKey: "smoking" }));
  }

  if (pol.pets) {
    let petsPolicyText: string;
    if (!pol.pets.allowed) {
      petsPolicyText = isEn ? `Pets are not allowed at ${name}.` : `No se admiten mascotas en ${name}.`;
    } else {
      const types = pol.pets.types?.join(", ") ?? (isEn ? "pets" : "mascotas");
      const countNote = pol.pets.maxCount
        ? isEn
          ? ` (maximum ${pol.pets.maxCount})`
          : ` (máximo ${pol.pets.maxCount})`
        : "";
      petsPolicyText = isEn
        ? `${types.charAt(0).toUpperCase() + types.slice(1)}${countNote} are allowed at ${name}.`
        : `Se admiten ${types}${countNote} en ${name}.`;
      if (pol.pets.notes) petsPolicyText += ` ${pol.pets.notes}`;
    }
    const t = tpl("pets", { petsPolicyText });
    if (t) chunks.push(mkPolicy({ ...t, chunkType: "policy", entityType: "policy", entityId: null, templateKey: "pets" }));
  }

  if (p.maxChildren > 0 || p.infantsAllowed) {
    const base = isEn
      ? p.maxChildren > 0
        ? `Children are allowed (maximum ${p.maxChildren}).`
        : "Children are allowed."
      : p.maxChildren > 0
        ? `Se admiten niños (máximo ${p.maxChildren}).`
        : "Se admiten niños.";
    const infantsSuffix = p.infantsAllowed
      ? isEn
        ? " Infants are also welcome."
        : " También se admiten bebés."
      : "";
    const childrenPolicyText = base + infantsSuffix;
    const t = tpl("children", { childrenPolicyText });
    if (t) chunks.push(mkPolicy({ ...t, chunkType: "policy", entityType: "policy", entityId: null, templateKey: "children" }));
  }

  if (pol.quietHours?.enabled && pol.quietHours.from && pol.quietHours.to) {
    const quietHoursPolicyText = isEn
      ? `Quiet hours at ${name} are from ${pol.quietHours.from} to ${pol.quietHours.to}.`
      : `El horario de silencio en ${name} es de ${pol.quietHours.from} a ${pol.quietHours.to}.`;
    const t = tpl("quiet_hours", { quietHoursPolicyText });
    if (t) chunks.push(mkPolicy({ ...t, chunkType: "policy", entityType: "policy", entityId: null, templateKey: "quiet_hours" }));
  }

  return chunks;
}

export async function extractFromContacts(
  propertyId: string,
  locale = "es",
  entityId?: string,
): Promise<ExtractedChunk[]> {
  const contacts = await prisma.contact.findMany({
    where: {
      propertyId,
      ...(entityId ? { id: entityId } : {}),
      visibility: { in: ["guest", "ai", "internal"] },
    },
    select: {
      id: true,
      roleKey: true,
      displayName: true,
      phone: true,
      whatsapp: true,
      email: true,
      availabilitySchedule: true,
      guestVisibleNotes: true,
      visibility: true,
    },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
  });

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { propertyNickname: true, city: true },
  });

  const chunks: ExtractedChunk[] = [];
  const isEn = locale === "en";

  for (const c of contacts) {
    const visibility = toNonSensitiveVisibility(c.visibility);
    const roleLabel =
      contactTypes.items.find((t) => t.id === c.roleKey)?.label ?? c.roleKey;

    const parts = [`${roleLabel}: ${c.displayName}.`];
    if (visibility === "guest" || visibility === "ai") {
      if (c.phone) parts.push(isEn ? `Phone: ${c.phone}.` : `Teléfono: ${c.phone}.`);
      if (c.whatsapp) parts.push(`WhatsApp: ${c.whatsapp}.`);
      if (c.email) parts.push(`Email: ${c.email}.`);
    }
    if (c.availabilitySchedule) {
      parts.push(isEn ? `Availability: ${c.availabilitySchedule}.` : `Disponibilidad: ${c.availabilitySchedule}.`);
    }
    if (c.guestVisibleNotes) parts.push(c.guestVisibleNotes);

    const bodyMd = parts.join(" ");
    const canonicalQuestion = isEn
      ? `Who do I contact for ${roleLabel}?`
      : `¿A quién contacto para ${roleLabel}?`;
    const topic = isEn ? `Contact: ${roleLabel}` : `Contacto: ${roleLabel}`;
    const sectionLabels = getSectionLabels(locale);
    const prefix = buildContextPrefix({
      propertyName: property.propertyNickname,
      city: property.city,
      sectionLabel: sectionLabels.contact,
      entityLabel: roleLabel,
      visibility,
      canonicalQuestion,
      locale,
    });

    chunks.push({
      propertyId,
      topic,
      bodyMd,
      locale,
      visibility,
      confidenceScore: 1.0,
      journeyStage: "any",
      chunkType: "fact",
      entityType: "contact",
      entityId: c.id,
      canonicalQuestion,
      contextPrefix: prefix,
      bm25Text: buildBm25Text(prefix, bodyMd, locale),
      tokens: approxTokens(prefix + " " + bodyMd),
      sourceFields: ["displayName", "roleKey", "phone", "whatsapp", "email", "availabilitySchedule", "guestVisibleNotes"],
      tags: [c.roleKey],
      contentHash: buildContentHash(prefix, bodyMd),
      templateKey: "contact_info",
      validFrom: null,
      validTo: null,
    });
  }

  return chunks;
}

export async function extractFromAmenities(
  propertyId: string,
  locale = "es",
  entityId?: string,
): Promise<ExtractedChunk[]> {
  const instances = await prisma.propertyAmenityInstance.findMany({
    where: {
      propertyId,
      ...(entityId ? { id: entityId } : {}),
      visibility: { not: "sensitive" },
    },
    select: {
      id: true,
      amenityKey: true,
      detailsJson: true,
      guestInstructions: true,
      visibility: true,
    },
  });

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { propertyNickname: true, city: true },
  });

  const chunks: ExtractedChunk[] = [];
  const isEn = locale === "en";

  for (const inst of instances) {
    const visibility = toNonSensitiveVisibility(inst.visibility);
    const amenityItem = findAmenityItem(inst.amenityKey);
    const amenityLabel = amenityItem?.label ?? inst.amenityKey;

    const details = inst.detailsJson as Record<string, string | null> | null;
    const detailsSummary = details
      ? Object.values(details)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
          .slice(0, 2)
          .join(". ")
      : null;

    const existenceBody = [
      isEn
        ? `${property.propertyNickname} has ${amenityLabel}.`
        : `${property.propertyNickname} dispone de ${amenityLabel}.`,
      detailsSummary,
    ]
      .filter(Boolean)
      .join(" ");

    const existenceQ = isEn
      ? `Does the property have ${amenityLabel}?`
      : `¿El alojamiento tiene ${amenityLabel}?`;
    const amenitySectionLabel = getSectionLabels(locale).amenity;
    const existencePrefix = buildContextPrefix({
      propertyName: property.propertyNickname,
      city: property.city,
      sectionLabel: amenitySectionLabel,
      entityLabel: amenityLabel,
      visibility,
      canonicalQuestion: existenceQ,
      locale,
    });

    chunks.push({
      propertyId,
      topic: amenityLabel,
      bodyMd: existenceBody,
      locale,
      visibility,
      confidenceScore: 1.0,
      journeyStage: "stay",
      chunkType: "fact",
      entityType: "amenity",
      entityId: inst.id,
      canonicalQuestion: existenceQ,
      contextPrefix: existencePrefix,
      bm25Text: buildBm25Text(existencePrefix, existenceBody, locale),
      tokens: approxTokens(existencePrefix + " " + existenceBody),
      sourceFields: ["amenityKey", "detailsJson"],
      tags: [inst.amenityKey],
      contentHash: buildContentHash(existencePrefix, existenceBody),
      templateKey: "amenity_existence",
      validFrom: null,
      validTo: null,
    });

    if (inst.guestInstructions && visibility !== "internal") {
      const usageQ = isEn
        ? `How do I use ${amenityLabel}?`
        : `¿Cómo se usa ${amenityLabel}?`;
      const usageTopic = isEn
        ? `How to use: ${amenityLabel}`
        : `Cómo usar: ${amenityLabel}`;
      const usagePrefix = buildContextPrefix({
        propertyName: property.propertyNickname,
        city: property.city,
        sectionLabel: amenitySectionLabel,
        entityLabel: usageTopic,
        visibility,
        canonicalQuestion: usageQ,
        locale,
      });
      chunks.push({
        propertyId,
        topic: usageTopic,
        bodyMd: inst.guestInstructions,
        locale,
        visibility,
        confidenceScore: 1.0,
        journeyStage: "stay",
        chunkType: "procedure",
        entityType: "amenity",
        entityId: inst.id,
        canonicalQuestion: usageQ,
        contextPrefix: usagePrefix,
        bm25Text: buildBm25Text(usagePrefix, inst.guestInstructions, locale),
        tokens: approxTokens(usagePrefix + " " + inst.guestInstructions),
        sourceFields: ["guestInstructions", "detailsJson"],
        tags: [inst.amenityKey],
        contentHash: buildContentHash(usagePrefix, inst.guestInstructions),
        templateKey: "amenity_usage",
        validFrom: null,
        validTo: null,
      });
    }
  }

  return chunks;
}

export async function extractFromSpaces(
  propertyId: string,
  locale = "es",
  entityId?: string,
): Promise<ExtractedChunk[]> {
  const spaces = await prisma.space.findMany({
    where: {
      propertyId,
      status: "active",
      ...(entityId ? { id: entityId } : {}),
      visibility: { not: "sensitive" },
    },
    select: {
      id: true,
      spaceType: true,
      name: true,
      guestNotes: true,
      visibility: true,
      beds: { select: { bedType: true, quantity: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { propertyNickname: true, city: true },
  });

  const chunks: ExtractedChunk[] = [];
  const isEn = locale === "en";

  for (const space of spaces) {
    const visibility = toNonSensitiveVisibility(space.visibility);
    const spaceTypeLabel = getSpaceTypeLabel(space.spaceType, space.spaceType);

    const bedSummary =
      space.beds.length > 0
        ? space.beds
            .map((b) => `${b.quantity}× ${resolveBedTypeLabel(b.bedType, locale)}`)
            .join(", ")
        : null;

    const bodyParts = [
      isEn
        ? `${space.name} is a ${spaceTypeLabel}.`
        : `${space.name} es un ${spaceTypeLabel}.`,
    ];
    if (space.guestNotes) bodyParts.push(space.guestNotes);
    if (bedSummary) bodyParts.push(isEn ? `Beds: ${bedSummary}.` : `Camas: ${bedSummary}.`);
    const bodyMd = bodyParts.join(" ");

    const canonicalQ = isEn
      ? `What is in ${space.name}?`
      : `¿Qué hay en ${space.name}?`;
    const prefix = buildContextPrefix({
      propertyName: property.propertyNickname,
      city: property.city,
      sectionLabel: getSectionLabels(locale).space,
      entityLabel: space.name,
      visibility,
      canonicalQuestion: canonicalQ,
      locale,
    });

    chunks.push({
      propertyId,
      topic: space.name,
      bodyMd,
      locale,
      visibility,
      confidenceScore: 1.0,
      journeyStage: "arrival",
      chunkType: "fact",
      entityType: "space",
      entityId: space.id,
      canonicalQuestion: canonicalQ,
      contextPrefix: prefix,
      bm25Text: buildBm25Text(prefix, bodyMd, locale),
      tokens: approxTokens(prefix + " " + bodyMd),
      sourceFields: ["name", "spaceType", "guestNotes", "beds"],
      tags: [space.spaceType],
      contentHash: buildContentHash(prefix, bodyMd),
      templateKey: "space_info",
      validFrom: null,
      validTo: null,
    });
  }

  return chunks;
}

export async function extractFromSystems(
  propertyId: string,
  locale = "es",
  entityId?: string,
): Promise<ExtractedChunk[]> {
  const systems = await prisma.propertySystem.findMany({
    where: {
      propertyId,
      ...(entityId ? { id: entityId } : {}),
      visibility: { not: "sensitive" },
    },
    select: {
      id: true,
      systemKey: true,
      detailsJson: true,
      opsJson: true,
      visibility: true,
    },
  });

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { propertyNickname: true, city: true },
  });

  const chunks: ExtractedChunk[] = [];
  const isEn = locale === "en";

  for (const sys of systems) {
    const visibility = toNonSensitiveVisibility(sys.visibility);
    const systemItem = findSystemItem(sys.systemKey);
    const systemLabel = systemItem?.label ?? sys.systemKey;

    const details = sys.detailsJson as Record<string, string | null> | null;
    const detailsSummary = details
      ? Object.values(details)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
          .slice(0, 2)
          .join(". ")
      : null;

    const descBody = [
      isEn
        ? `${property.propertyNickname} has ${systemLabel}.`
        : `${property.propertyNickname} dispone de ${systemLabel}.`,
      detailsSummary,
    ]
      .filter(Boolean)
      .join(" ");

    const descQ = isEn
      ? `How does ${systemLabel} work at ${property.propertyNickname}?`
      : `¿Cómo funciona ${systemLabel} en ${property.propertyNickname}?`;
    const systemSectionLabel = getSectionLabels(locale).system;
    const descPrefix = buildContextPrefix({
      propertyName: property.propertyNickname,
      city: property.city,
      sectionLabel: systemSectionLabel,
      entityLabel: systemLabel,
      visibility,
      canonicalQuestion: descQ,
      locale,
    });

    chunks.push({
      propertyId,
      topic: isEn ? `System: ${systemLabel}` : `Sistema: ${systemLabel}`,
      bodyMd: descBody,
      locale,
      visibility,
      confidenceScore: 1.0,
      journeyStage: "stay",
      chunkType: "fact",
      entityType: "system",
      entityId: sys.id,
      canonicalQuestion: descQ,
      contextPrefix: descPrefix,
      bm25Text: buildBm25Text(descPrefix, descBody, locale),
      tokens: approxTokens(descPrefix + " " + descBody),
      sourceFields: ["systemKey", "detailsJson"],
      tags: [sys.systemKey],
      contentHash: buildContentHash(descPrefix, descBody),
      templateKey: "system_info",
      validFrom: null,
      validTo: null,
    });

    const ops = sys.opsJson as Record<string, string | null> | null;
    const opsNotes = ops
      ? Object.values(ops)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
          .join(". ")
      : null;

    if (opsNotes) {
      const tsQ = isEn
        ? `What do I do if ${systemLabel} is not working?`
        : `¿Qué hago si ${systemLabel} no funciona?`;
      const tsBody = isEn
        ? `If ${systemLabel} is not working: ${opsNotes}`
        : `Si ${systemLabel} no funciona: ${opsNotes}`;
      const tsTopic = isEn
        ? `${systemLabel} — troubleshooting`
        : `${systemLabel} — resolución de problemas`;
      const tsPrefix = buildContextPrefix({
        propertyName: property.propertyNickname,
        city: property.city,
        sectionLabel: systemSectionLabel,
        entityLabel: tsTopic,
        visibility,
        canonicalQuestion: tsQ,
        locale,
      });

      chunks.push({
        propertyId,
        topic: tsTopic,
        bodyMd: tsBody,
        locale,
        visibility,
        confidenceScore: 1.0,
        journeyStage: "stay",
        chunkType: "troubleshooting",
        entityType: "system",
        entityId: sys.id,
        canonicalQuestion: tsQ,
        contextPrefix: tsPrefix,
        bm25Text: buildBm25Text(tsPrefix, tsBody, locale),
        tokens: approxTokens(tsPrefix + " " + tsBody),
        sourceFields: ["systemKey", "detailsJson", "opsJson"],
        tags: [sys.systemKey],
        contentHash: buildContentHash(tsPrefix, tsBody),
        templateKey: "system_troubleshooting",
        validFrom: null,
        validTo: null,
      });
    }
  }

  return chunks;
}

// ──────────────────────────────────────────────
// Persistence helpers
// ──────────────────────────────────────────────

function chunkToCreateInput(c: ExtractedChunk) {
  return {
    propertyId: c.propertyId,
    topic: c.topic,
    bodyMd: c.bodyMd,
    locale: c.locale,
    visibility: c.visibility,
    confidenceScore: c.confidenceScore,
    isAutoExtracted: true,
    journeyStage: c.journeyStage,
    chunkType: c.chunkType,
    entityType: c.entityType,
    entityId: c.entityId,
    canonicalQuestion: c.canonicalQuestion,
    contextPrefix: c.contextPrefix,
    bm25Text: c.bm25Text,
    tokens: c.tokens,
    sourceFields: c.sourceFields,
    tags: c.tags,
    contentHash: c.contentHash,
    templateKey: c.templateKey,
    validFrom: c.validFrom,
    validTo: c.validTo,
  };
}

async function upsertSection(
  propertyId: string,
  entityType: EntityType,
  entityId: string | null,
  locale: string,
  chunks: ExtractedChunk[],
): Promise<void> {
  await prisma.$transaction([
    prisma.knowledgeItem.deleteMany({
      where: {
        propertyId,
        entityType,
        locale,
        isAutoExtracted: true,
        ...(entityId !== null ? { entityId } : {}),
      },
    }),
    ...(chunks.length > 0
      ? [prisma.knowledgeItem.createMany({ data: chunks.map(chunkToCreateInput) })]
      : []),
  ]);
}

async function extractSection(
  propertyId: string,
  entityType: EntityType,
  entityId: string | null,
  locale = "es",
): Promise<void> {
  let chunks: ExtractedChunk[];
  switch (entityType) {
    case "property":
      chunks = await extractFromProperty(propertyId, locale);
      break;
    case "access":
      chunks = await extractFromAccess(propertyId, locale);
      break;
    case "policy":
      chunks = await extractFromPolicies(propertyId, locale);
      break;
    case "contact":
      chunks = await extractFromContacts(propertyId, locale, entityId ?? undefined);
      break;
    case "amenity":
      chunks = await extractFromAmenities(propertyId, locale, entityId ?? undefined);
      break;
    case "space":
      chunks = await extractFromSpaces(propertyId, locale, entityId ?? undefined);
      break;
    case "system":
      chunks = await extractFromSystems(propertyId, locale, entityId ?? undefined);
      break;
  }
  await upsertSection(propertyId, entityType, entityId, locale, chunks);
}

// ──────────────────────────────────────────────
// Orchestrator
// ──────────────────────────────────────────────

export async function extractFromPropertyAll(
  propertyId: string,
  locale = "es",
): Promise<{ count: number }> {
  const [
    propertyChunks,
    accessChunks,
    policyChunks,
    contactChunks,
    amenityChunks,
    spaceChunks,
    systemChunks,
  ] = await Promise.all([
    extractFromProperty(propertyId, locale),
    extractFromAccess(propertyId, locale),
    extractFromPolicies(propertyId, locale),
    extractFromContacts(propertyId, locale),
    extractFromAmenities(propertyId, locale),
    extractFromSpaces(propertyId, locale),
    extractFromSystems(propertyId, locale),
  ]);

  const all = [
    ...propertyChunks,
    ...accessChunks,
    ...policyChunks,
    ...contactChunks,
    ...amenityChunks,
    ...spaceChunks,
    ...systemChunks,
  ];

  await prisma.$transaction([
    prisma.knowledgeItem.deleteMany({ where: { propertyId, locale, isAutoExtracted: true } }),
    ...(all.length > 0
      ? [prisma.knowledgeItem.createMany({ data: all.map(chunkToCreateInput) })]
      : []),
  ]);

  return { count: all.length };
}

// ──────────────────────────────────────────────
// Invalidation
// ──────────────────────────────────────────────

export async function invalidateKnowledge(
  propertyId: string,
  entityType: EntityType,
  entityId: string | null,
): Promise<void> {
  // Resolve the property's defaultLocale so background invalidation re-
  // extracts in the right language. Falling back to `extractSection`'s
  // parameter default ("es") would regenerate Spanish chunks on a property
  // configured in English, mixing locales on every edit.
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { defaultLocale: true },
  });
  const locale = property?.defaultLocale ?? "es";
  await extractSection(propertyId, entityType, entityId, locale);
}

export function invalidateKnowledgeInBackground(
  propertyId: string,
  entityType: EntityType,
  entityId: string | null,
): void {
  invalidateKnowledge(propertyId, entityType, entityId).catch((err) => {
    console.error(
      `[knowledge-extract] invalidation failed for ${propertyId} (${entityType}/${entityId ?? "all"}):`,
      err,
    );
  });
}

export async function deleteEntityChunks(
  propertyId: string,
  entityType: EntityType,
  entityId: string,
): Promise<void> {
  await prisma.knowledgeItem.deleteMany({
    where: { propertyId, entityType, entityId },
  });
}

export function deleteEntityChunksInBackground(
  propertyId: string,
  entityType: EntityType,
  entityId: string,
): void {
  deleteEntityChunks(propertyId, entityType, entityId).catch((err) => {
    console.error(
      `[knowledge-extract] delete failed for ${propertyId} (${entityType}/${entityId}):`,
      err,
    );
  });
}
