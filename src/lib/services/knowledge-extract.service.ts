import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import {
  findSystemItem,
  findAmenityItem,
  getSpaceTypeLabel,
  contactTypes,
  propertyTypes,
  accessMethods,
} from "@/lib/taxonomy-loader";
import type { ExtractedChunk, ChunkType, EntityType } from "@/lib/types/knowledge";
import type { VisibilityLevel } from "@prisma/client";

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

const AUDIENCE_LABELS: Record<string, string> = {
  guest: "huéspedes durante la estancia",
  ai: "uso interno de IA",
  internal: "uso interno",
  sensitive: "uso interno restringido",
};

const SENSITIVITY_LABELS: Record<string, string> = {
  guest: "baja",
  ai: "media",
  internal: "alta",
  sensitive: "máxima",
};

const SPANISH_STOPWORDS = new Set([
  "a", "al", "con", "de", "del", "el", "en", "es", "la", "las", "le", "lo",
  "los", "no", "o", "para", "por", "que", "se", "si", "su", "un", "una", "y",
]);

// ──────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────

export function buildContextPrefix(params: {
  propertyName: string;
  city: string | null;
  sectionLabel: string;
  entityLabel: string;
  visibility: string;
  canonicalQuestion: string;
}): string {
  const location = params.city ?? "";
  const locationPart = location ? `, ${location}` : "";
  return [
    `Propiedad: ${params.propertyName}${locationPart}.`,
    `Sección: ${params.sectionLabel} > ${params.entityLabel}.`,
    `Destinado a: ${AUDIENCE_LABELS[params.visibility] ?? params.visibility}.`,
    `Sensibilidad: ${SENSITIVITY_LABELS[params.visibility] ?? "media"}.`,
    `Pregunta que responde: "${params.canonicalQuestion}"`,
  ].join("\n");
}

export function buildBm25Text(contextPrefix: string, bodyMd: string): string {
  return `${contextPrefix} ${bodyMd}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !SPANISH_STOPWORDS.has(w))
    .join(" ");
}

export function buildContentHash(contextPrefix: string, bodyMd: string): string {
  return createHash("sha256")
    .update(`${contextPrefix}\n${bodyMd}`)
    .digest("hex")
    .slice(0, 16);
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
  journeyStage: string;
  sourceFields: string[];
  tags?: string[];
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
  const visibility = params.visibility ?? "guest";

  // Invariant: no chunk may have higher visibility than its source entity.
  // Property-level extractors always emit guest visibility.
  assertVisibilityBound("guest", visibility);

  const canonicalQuestion = params.canonicalQuestion ?? params.topic;
  const contextPrefix = buildContextPrefix({
    propertyName,
    city,
    sectionLabel: SECTION_LABELS[params.entityType],
    entityLabel: params.topic,
    visibility,
    canonicalQuestion,
  });
  const bm25Text = buildBm25Text(contextPrefix, params.bodyMd);
  const contentHash = buildContentHash(contextPrefix, params.bodyMd);
  return {
    propertyId,
    topic: params.topic,
    bodyMd: params.bodyMd,
    locale,
    visibility: visibility as "guest" | "ai" | "internal",
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

// ──────────────────────────────────────────────
// Access sanitization helpers
// ──────────────────────────────────────────────

// Returns only taxonomy-derived labels — never includes customDesc (may contain PINs/codes).
function resolveAccessMethodLabels(methods: string[]): string {
  return methods
    .map((m) => accessMethods.items.find((a) => a.id === m)?.label ?? m)
    .join(", ");
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

  if (p.checkInStart && p.checkInEnd) {
    chunks.push(
      mk({
        topic: "Hora de check-in",
        canonicalQuestion: "¿A qué hora empieza el check-in?",
        bodyMd: `El check-in en ${name} es a partir de las ${p.checkInStart} y hasta las ${p.checkInEnd}.`,
        chunkType: "fact",
        entityType: "property",
        entityId: null,
        journeyStage: "pre_arrival",
        sourceFields: ["checkInStart", "checkInEnd"],
      }),
    );
  }

  if (p.checkOutTime) {
    chunks.push(
      mk({
        topic: "Hora de check-out",
        canonicalQuestion: "¿A qué hora es el check-out?",
        bodyMd: `El check-out en ${name} debe realizarse antes de las ${p.checkOutTime}.`,
        chunkType: "fact",
        entityType: "property",
        entityId: null,
        journeyStage: "checkout",
        sourceFields: ["checkOutTime"],
      }),
    );
  }

  if (p.maxGuests) {
    const childrenNote =
      p.maxChildren > 0
        ? ` y ${p.maxChildren} niños${p.infantsAllowed ? " (bebés admitidos)" : ""}`
        : "";
    chunks.push(
      mk({
        topic: "Capacidad del alojamiento",
        canonicalQuestion: "¿Cuántas personas pueden alojarse?",
        bodyMd: `${name} tiene capacidad para ${p.maxGuests} personas (máximo ${p.maxAdults} adultos${childrenNote}).`,
        chunkType: "fact",
        entityType: "property",
        entityId: null,
        journeyStage: "pre_arrival",
        sourceFields: ["maxGuests", "maxAdults", "maxChildren", "infantsAllowed"],
      }),
    );
  }

  if (p.propertyType) {
    const typeLabel =
      propertyTypes.items.find((t) => t.id === p.propertyType)?.label ??
      p.propertyType;
    const locationPart = p.city
      ? `${p.city}${p.country ? `, ${p.country}` : ""}`
      : p.country ?? "";
    chunks.push(
      mk({
        topic: "Descripción general",
        canonicalQuestion: "¿Qué tipo de alojamiento es y dónde está?",
        bodyMd: `${name} es un ${typeLabel}${locationPart ? ` ubicado en ${locationPart}` : ""}.`,
        chunkType: "fact",
        entityType: "property",
        entityId: null,
        journeyStage: "pre_arrival",
        sourceFields: ["propertyNickname", "propertyType", "city", "country"],
      }),
    );
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

  if (access?.unit?.methods?.length) {
    const accessDesc = buildSafeAccessDescription(access.unit, "Método de acceso disponible");
    const prefix = buildContextPrefix({
      propertyName: name,
      city,
      sectionLabel: SECTION_LABELS.access,
      entityLabel: "Acceso a la unidad",
      visibility: "guest",
      canonicalQuestion: "¿Cómo se accede al alojamiento?",
    });
    const bodyMd = `Para acceder a ${name}: ${accessDesc}`;
    chunks.push({
      propertyId,
      topic: "Acceso a la unidad",
      bodyMd,
      locale,
      visibility: "guest",
      confidenceScore: 1.0,
      journeyStage: "arrival",
      chunkType: "procedure",
      entityType: "access",
      entityId: null,
      canonicalQuestion: "¿Cómo se accede al alojamiento?",
      contextPrefix: prefix,
      bm25Text: buildBm25Text(prefix, bodyMd),
      tokens: approxTokens(prefix + " " + bodyMd),
      sourceFields: ["primaryAccessMethod", "accessMethodsJson"],
      tags: [],
      contentHash: buildContentHash(prefix, bodyMd),
      validFrom: null,
      validTo: null,
    });
  }

  if (p.hasBuildingAccess && access?.building?.methods?.length) {
    const buildingDesc = buildSafeAccessDescription(access.building, "Acceso al edificio disponible");
    const prefix = buildContextPrefix({
      propertyName: name,
      city,
      sectionLabel: SECTION_LABELS.access,
      entityLabel: "Acceso al edificio",
      visibility: "guest",
      canonicalQuestion: "¿Cómo se entra al edificio?",
    });
    const bodyMd = `Para entrar al edificio de ${name}: ${buildingDesc}`;
    chunks.push({
      propertyId,
      topic: "Acceso al edificio",
      bodyMd,
      locale,
      visibility: "guest",
      confidenceScore: 1.0,
      journeyStage: "arrival",
      chunkType: "procedure",
      entityType: "access",
      entityId: null,
      canonicalQuestion: "¿Cómo se entra al edificio?",
      contextPrefix: prefix,
      bm25Text: buildBm25Text(prefix, bodyMd),
      tokens: approxTokens(prefix + " " + bodyMd),
      sourceFields: ["accessMethodsJson", "hasBuildingAccess"],
      tags: [],
      contentHash: buildContentHash(prefix, bodyMd),
      validFrom: null,
      validTo: null,
    });
  }

  if (p.checkInStart && p.checkInEnd && p.checkOutTime) {
    const autonomousPart = p.isAutonomousCheckin
      ? " El acceso es autónomo, sin necesidad de recibimiento en persona."
      : "";
    const accessSummary = access?.unit?.methods?.length
      ? buildSafeAccessDescription(access.unit, "Método de acceso disponible")
      : "";
    const prefix = buildContextPrefix({
      propertyName: name,
      city,
      sectionLabel: SECTION_LABELS.access,
      entityLabel: "Logística de llegada",
      visibility: "guest",
      canonicalQuestion: "¿Qué debo saber para llegar al alojamiento?",
    });
    const bodyMd = [
      `Llegada a ${name}: check-in entre las ${p.checkInStart} y las ${p.checkInEnd}.`,
      `Check-out antes de las ${p.checkOutTime}.`,
      autonomousPart,
      accessSummary ? `Acceso: ${accessSummary}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    chunks.push({
      propertyId,
      topic: "Logística de llegada",
      bodyMd,
      locale,
      visibility: "guest",
      confidenceScore: 1.0,
      journeyStage: "pre_arrival",
      chunkType: "procedure",
      entityType: "access",
      entityId: null,
      canonicalQuestion: "¿Qué debo saber para llegar al alojamiento?",
      contextPrefix: prefix,
      bm25Text: buildBm25Text(prefix, bodyMd),
      tokens: approxTokens(prefix + " " + bodyMd),
      sourceFields: [
        "checkInStart",
        "checkInEnd",
        "checkOutTime",
        "isAutonomousCheckin",
        "primaryAccessMethod",
        "accessMethodsJson",
      ],
      tags: [],
      contentHash: buildContentHash(prefix, bodyMd),
      validFrom: null,
      validTo: null,
    });
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
  const pol = p.policiesJson as {
    quietHours?: { enabled?: boolean; from?: string; to?: string };
    smoking?: string;
    pets?: { allowed?: boolean; types?: string[]; maxCount?: number; sizeRestriction?: string; notes?: string };
  } | null;

  if (!pol) return chunks;

  const mkPolicy = (
    topic: string,
    canonicalQuestion: string,
    bodyMd: string,
    sourceFields: string[],
  ): ExtractedChunk => {
    const prefix = buildContextPrefix({
      propertyName: name,
      city,
      sectionLabel: SECTION_LABELS.policy,
      entityLabel: topic,
      visibility: "guest",
      canonicalQuestion,
    });
    return {
      propertyId,
      topic,
      bodyMd,
      locale,
      visibility: "guest",
      confidenceScore: 1.0,
      journeyStage: "any",
      chunkType: "policy",
      entityType: "policy",
      entityId: null,
      canonicalQuestion,
      contextPrefix: prefix,
      bm25Text: buildBm25Text(prefix, bodyMd),
      tokens: approxTokens(prefix + " " + bodyMd),
      sourceFields,
      tags: [],
      contentHash: buildContentHash(prefix, bodyMd),
      validFrom: null,
      validTo: null,
    };
  };

  if (pol.smoking) {
    const smokingLabels: Record<string, string> = {
      not_allowed: "No se permite fumar en ningún lugar del alojamiento.",
      outdoors_only: "Solo se permite fumar en zonas exteriores.",
      designated_area: "Hay una zona habilitada para fumadores.",
      no_restriction: "No hay restricciones para fumar.",
    };
    const text = smokingLabels[pol.smoking] ?? `Política de fumadores: ${pol.smoking}.`;
    chunks.push(mkPolicy("Política de fumadores", "¿Se puede fumar en el alojamiento?", text, ["policiesJson"]));
  }

  if (pol.pets) {
    let text: string;
    if (!pol.pets.allowed) {
      text = `No se admiten mascotas en ${name}.`;
    } else {
      const types = pol.pets.types?.join(", ") ?? "mascotas";
      const countNote = pol.pets.maxCount ? ` (máximo ${pol.pets.maxCount})` : "";
      text = `Se admiten ${types}${countNote} en ${name}.`;
      if (pol.pets.notes) text += ` ${pol.pets.notes}`;
    }
    chunks.push(mkPolicy("Política de mascotas", "¿Se admiten mascotas?", text, ["policiesJson"]));
  }

  if (p.maxChildren > 0 || p.infantsAllowed) {
    const childrenText = p.maxChildren > 0
      ? `Se admiten niños (máximo ${p.maxChildren}).`
      : "Se admiten niños.";
    const infantsText = p.infantsAllowed ? " También se admiten bebés." : "";
    chunks.push(
      mkPolicy(
        "Política sobre niños",
        "¿Se admiten niños?",
        childrenText + infantsText,
        ["policiesJson", "infantsAllowed", "maxChildren"],
      ),
    );
  }

  if (pol.quietHours?.enabled && pol.quietHours.from && pol.quietHours.to) {
    const text = `El horario de silencio en ${name} es de ${pol.quietHours.from} a ${pol.quietHours.to}.`;
    chunks.push(mkPolicy("Horario de silencio", "¿Hay horario de silencio?", text, ["policiesJson"]));
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

  for (const c of contacts) {
    // Propagate visibility from source entity
    assertVisibilityBound(c.visibility, c.visibility);

    const roleLabel =
      contactTypes.items.find((t) => t.id === c.roleKey)?.label ?? c.roleKey;

    const parts = [`${roleLabel}: ${c.displayName}.`];
    if (c.visibility === "guest" || c.visibility === "ai") {
      if (c.phone) parts.push(`Teléfono: ${c.phone}.`);
      if (c.whatsapp) parts.push(`WhatsApp: ${c.whatsapp}.`);
      if (c.email) parts.push(`Email: ${c.email}.`);
    }
    if (c.availabilitySchedule) parts.push(`Disponibilidad: ${c.availabilitySchedule}.`);
    if (c.guestVisibleNotes) parts.push(c.guestVisibleNotes);

    const bodyMd = parts.join(" ");
    const canonicalQuestion = `¿A quién contacto para ${roleLabel}?`;
    const prefix = buildContextPrefix({
      propertyName: property.propertyNickname,
      city: property.city,
      sectionLabel: SECTION_LABELS.contact,
      entityLabel: roleLabel,
      visibility: c.visibility,
      canonicalQuestion,
    });

    chunks.push({
      propertyId,
      topic: `Contacto: ${roleLabel}`,
      bodyMd,
      locale,
      visibility: c.visibility as "guest" | "ai" | "internal",
      confidenceScore: 1.0,
      journeyStage: "any",
      chunkType: "fact",
      entityType: "contact",
      entityId: c.id,
      canonicalQuestion,
      contextPrefix: prefix,
      bm25Text: buildBm25Text(prefix, bodyMd),
      tokens: approxTokens(prefix + " " + bodyMd),
      sourceFields: ["displayName", "roleKey", "phone", "whatsapp", "email", "availabilitySchedule", "guestVisibleNotes"],
      tags: [c.roleKey],
      contentHash: buildContentHash(prefix, bodyMd),
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

  for (const inst of instances) {
    assertVisibilityBound(inst.visibility, inst.visibility);

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
      `${property.propertyNickname} dispone de ${amenityLabel}.`,
      detailsSummary,
    ]
      .filter(Boolean)
      .join(" ");

    const existenceQ = `¿El alojamiento tiene ${amenityLabel}?`;
    const existencePrefix = buildContextPrefix({
      propertyName: property.propertyNickname,
      city: property.city,
      sectionLabel: SECTION_LABELS.amenity,
      entityLabel: amenityLabel,
      visibility: inst.visibility,
      canonicalQuestion: existenceQ,
    });

    chunks.push({
      propertyId,
      topic: amenityLabel,
      bodyMd: existenceBody,
      locale,
      visibility: inst.visibility as "guest" | "ai" | "internal",
      confidenceScore: 1.0,
      journeyStage: "stay",
      chunkType: "fact",
      entityType: "amenity",
      entityId: inst.id,
      canonicalQuestion: existenceQ,
      contextPrefix: existencePrefix,
      bm25Text: buildBm25Text(existencePrefix, existenceBody),
      tokens: approxTokens(existencePrefix + " " + existenceBody),
      sourceFields: ["amenityKey", "detailsJson"],
      tags: [inst.amenityKey],
      contentHash: buildContentHash(existencePrefix, existenceBody),
      validFrom: null,
      validTo: null,
    });

    if (inst.guestInstructions && inst.visibility !== "internal") {
      const usageQ = `¿Cómo se usa ${amenityLabel}?`;
      const usagePrefix = buildContextPrefix({
        propertyName: property.propertyNickname,
        city: property.city,
        sectionLabel: SECTION_LABELS.amenity,
        entityLabel: `Cómo usar: ${amenityLabel}`,
        visibility: inst.visibility,
        canonicalQuestion: usageQ,
      });
      chunks.push({
        propertyId,
        topic: `Cómo usar: ${amenityLabel}`,
        bodyMd: inst.guestInstructions,
        locale,
        visibility: inst.visibility as "guest" | "ai" | "internal",
        confidenceScore: 1.0,
        journeyStage: "stay",
        chunkType: "procedure",
        entityType: "amenity",
        entityId: inst.id,
        canonicalQuestion: usageQ,
        contextPrefix: usagePrefix,
        bm25Text: buildBm25Text(usagePrefix, inst.guestInstructions),
        tokens: approxTokens(usagePrefix + " " + inst.guestInstructions),
        sourceFields: ["guestInstructions", "detailsJson"],
        tags: [inst.amenityKey],
        contentHash: buildContentHash(usagePrefix, inst.guestInstructions),
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

  for (const space of spaces) {
    assertVisibilityBound(space.visibility, space.visibility);

    const spaceTypeLabel = getSpaceTypeLabel(space.spaceType, space.spaceType);

    const bedSummary =
      space.beds.length > 0
        ? space.beds
            .map((b) => `${b.quantity}× ${b.bedType}`)
            .join(", ")
        : null;

    const bodyParts = [`${space.name} es un ${spaceTypeLabel}.`];
    if (space.guestNotes) bodyParts.push(space.guestNotes);
    if (bedSummary) bodyParts.push(`Camas: ${bedSummary}.`);
    const bodyMd = bodyParts.join(" ");

    const canonicalQ = `¿Qué hay en ${space.name}?`;
    const prefix = buildContextPrefix({
      propertyName: property.propertyNickname,
      city: property.city,
      sectionLabel: SECTION_LABELS.space,
      entityLabel: space.name,
      visibility: space.visibility,
      canonicalQuestion: canonicalQ,
    });

    chunks.push({
      propertyId,
      topic: space.name,
      bodyMd,
      locale,
      visibility: space.visibility as "guest" | "ai" | "internal",
      confidenceScore: 1.0,
      journeyStage: "arrival",
      chunkType: "fact",
      entityType: "space",
      entityId: space.id,
      canonicalQuestion: canonicalQ,
      contextPrefix: prefix,
      bm25Text: buildBm25Text(prefix, bodyMd),
      tokens: approxTokens(prefix + " " + bodyMd),
      sourceFields: ["name", "spaceType", "guestNotes", "featuresJson"],
      tags: [space.spaceType],
      contentHash: buildContentHash(prefix, bodyMd),
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

  for (const sys of systems) {
    assertVisibilityBound(sys.visibility, sys.visibility);

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
      `${property.propertyNickname} dispone de ${systemLabel}.`,
      detailsSummary,
    ]
      .filter(Boolean)
      .join(" ");

    const descQ = `¿Cómo funciona ${systemLabel} en ${property.propertyNickname}?`;
    const descPrefix = buildContextPrefix({
      propertyName: property.propertyNickname,
      city: property.city,
      sectionLabel: SECTION_LABELS.system,
      entityLabel: systemLabel,
      visibility: sys.visibility,
      canonicalQuestion: descQ,
    });

    chunks.push({
      propertyId,
      topic: `Sistema: ${systemLabel}`,
      bodyMd: descBody,
      locale,
      visibility: sys.visibility as "guest" | "ai" | "internal",
      confidenceScore: 1.0,
      journeyStage: "stay",
      chunkType: "fact",
      entityType: "system",
      entityId: sys.id,
      canonicalQuestion: descQ,
      contextPrefix: descPrefix,
      bm25Text: buildBm25Text(descPrefix, descBody),
      tokens: approxTokens(descPrefix + " " + descBody),
      sourceFields: ["systemKey", "detailsJson"],
      tags: [sys.systemKey],
      contentHash: buildContentHash(descPrefix, descBody),
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
      const tsQ = `¿Qué hago si ${systemLabel} no funciona?`;
      const tsBody = `Si ${systemLabel} no funciona: ${opsNotes}`;
      const tsPrefix = buildContextPrefix({
        propertyName: property.propertyNickname,
        city: property.city,
        sectionLabel: SECTION_LABELS.system,
        entityLabel: `${systemLabel} — resolución de problemas`,
        visibility: sys.visibility,
        canonicalQuestion: tsQ,
      });

      chunks.push({
        propertyId,
        topic: `${systemLabel} — resolución de problemas`,
        bodyMd: tsBody,
        locale,
        visibility: sys.visibility as "guest" | "ai" | "internal",
        confidenceScore: 1.0,
        journeyStage: "stay",
        chunkType: "troubleshooting",
        entityType: "system",
        entityId: sys.id,
        canonicalQuestion: tsQ,
        contextPrefix: tsPrefix,
        bm25Text: buildBm25Text(tsPrefix, tsBody),
        tokens: approxTokens(tsPrefix + " " + tsBody),
        sourceFields: ["systemKey", "detailsJson", "opsJson"],
        tags: [sys.systemKey],
        contentHash: buildContentHash(tsPrefix, tsBody),
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
    validFrom: c.validFrom,
    validTo: c.validTo,
  };
}

async function upsertSection(
  propertyId: string,
  entityType: EntityType,
  entityId: string | null,
  chunks: ExtractedChunk[],
): Promise<void> {
  await prisma.$transaction([
    prisma.knowledgeItem.deleteMany({
      where: {
        propertyId,
        entityType,
        ...(entityId !== null ? { entityId } : {}),
      },
    }),
    prisma.knowledgeItem.createMany({ data: chunks.map(chunkToCreateInput) }),
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
  await upsertSection(propertyId, entityType, entityId, chunks);
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

  // Full rebuild: delete all existing items for this property, then insert fresh.
  await prisma.$transaction([
    prisma.knowledgeItem.deleteMany({ where: { propertyId } }),
    prisma.knowledgeItem.createMany({ data: all.map(chunkToCreateInput) }),
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
  await extractSection(propertyId, entityType, entityId);
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
