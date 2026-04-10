/**
 * Section editor schema definitions.
 *
 * Declares the workspace modules (sections) that appear in the property
 * overview. Each section declares its taxonomy source, the fields it
 * manages, and how its completeness is evaluated.
 *
 * Adding a new section:
 * 1. Add entry here
 * 2. Create corresponding Prisma model (if new entity)
 * 3. Create repository
 * 4. Create page under /properties/[propertyId]/[sectionKey]
 *
 * The section list, labels, and statuses are all config-driven.
 */

export type SectionStatus = "empty" | "in_progress" | "ready";

export interface SectionEditorDef {
  /** Stable key matching the route segment */
  key: string;
  /** Display label (Spanish) */
  label: string;
  /** Short description (Spanish) */
  description: string;
  /** Navigation group */
  group: "content" | "outputs" | "operations";
  /** Phase in which this editor is implemented */
  phase: number;
  /** Property fields that determine completeness */
  completenessFields?: string[];
  /** Taxonomy source key (if section is taxonomy-driven) */
  taxonomySource?: string;
  /** Whether the section supports list/detail pattern */
  hasList?: boolean;
  /** Whether the section has a detail route */
  hasDetail?: boolean;
}

export const SECTION_EDITORS: SectionEditorDef[] = [
  // ── Content group ──
  {
    key: "property",
    label: "Propiedad",
    description: "Identidad, ubicación y capacidad",
    group: "content",
    phase: 3,
    completenessFields: ["propertyType", "country", "maxGuests"],
  },
  {
    key: "access",
    label: "Acceso y check-in",
    description: "Horarios, métodos de acceso y anfitrión",
    group: "content",
    phase: 3,
    completenessFields: ["checkInStart", "primaryAccessMethod"],
  },
  {
    key: "contacts",
    label: "Contactos",
    description: "Anfitrión, limpieza, mantenimiento y otros",
    group: "content",
    phase: 3,
  },
  {
    key: "policies",
    label: "Normas",
    description: "Normas de convivencia y restricciones",
    group: "content",
    phase: 4,
    taxonomySource: "policyTaxonomy",
  },
  {
    key: "spaces",
    label: "Espacios",
    description: "Dormitorios, baños, cocina y más",
    group: "content",
    phase: 4,
    taxonomySource: "spaceTypes",
    hasList: true,
    hasDetail: true,
  },
  {
    key: "amenities",
    label: "Equipamiento",
    description: "Amenities disponibles para huéspedes",
    group: "content",
    phase: 4,
    taxonomySource: "amenityTaxonomy",
    hasList: true,
    hasDetail: true,
  },
  {
    key: "troubleshooting",
    label: "Incidencias",
    description: "Playbooks para resolver problemas comunes",
    group: "content",
    phase: 4,
    taxonomySource: "troubleshootingTaxonomy",
    hasList: true,
    hasDetail: true,
  },
  {
    key: "local-guide",
    label: "Guía local",
    description: "Recomendaciones cercanas",
    group: "content",
    phase: 4,
    hasList: true,
    hasDetail: true,
  },
  // ── Outputs group ──
  {
    key: "knowledge",
    label: "Base de conocimiento",
    description: "Datos estructurados para IA y guía",
    group: "outputs",
    phase: 5,
  },
  {
    key: "guest-guide",
    label: "Guía del huésped",
    description: "Versiones publicables de la guía",
    group: "outputs",
    phase: 5,
    taxonomySource: "guideOutputs",
  },
  {
    key: "ai",
    label: "Asistente IA",
    description: "Conversaciones y retrieval pipeline",
    group: "outputs",
    phase: 5,
  },
  {
    key: "messaging",
    label: "Mensajería",
    description: "Templates y automatizaciones",
    group: "outputs",
    phase: 6,
    taxonomySource: "messagingTouchpoints",
    hasList: true,
    hasDetail: true,
  },
  // ── Operations group ──
  {
    key: "media",
    label: "Media",
    description: "Fotos, vídeos y assets",
    group: "operations",
    phase: 4,
    taxonomySource: "mediaRequirements",
    hasList: true,
  },
  {
    key: "ops",
    label: "Operaciones",
    description: "Checklist, stock e inventario",
    group: "operations",
    phase: 7,
  },
  {
    key: "activity",
    label: "Actividad",
    description: "Historial de cambios y auditoría",
    group: "operations",
    phase: 7,
  },
];

export function getSectionEditor(key: string): SectionEditorDef | undefined {
  return SECTION_EDITORS.find((s) => s.key === key);
}

export function getSectionsByGroup(group: SectionEditorDef["group"]): SectionEditorDef[] {
  return SECTION_EDITORS.filter((s) => s.group === group);
}

export function getSectionsForPhase(phase: number): SectionEditorDef[] {
  return SECTION_EDITORS.filter((s) => s.phase <= phase);
}
