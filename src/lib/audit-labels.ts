import type { BadgeTone } from "@/lib/types";

export const ENTITY_LABELS: Record<string, string> = {
  Property: "Propiedad",
  Space: "Espacio",
  PropertyAmenityInstance: "Amenity",
  TroubleshootingPlaybook: "Playbook",
  LocalPlace: "Lugar local",
  MediaAsset: "Media",
  KnowledgeItem: "Conocimiento",
  GuideVersion: "Guía",
  MessageTemplate: "Plantilla",
  MessageAutomation: "Automatización",
  OpsChecklistItem: "Checklist",
  StockItem: "Stock",
  MaintenanceTask: "Mantenimiento",
};

export const ACTION_LABELS: Record<
  string,
  { label: string; tone: BadgeTone; verbPast: string }
> = {
  create: { label: "Crear", tone: "success", verbPast: "creado" },
  update: { label: "Actualizar", tone: "neutral", verbPast: "actualizado" },
  delete: { label: "Eliminar", tone: "danger", verbPast: "eliminado" },
  publish: { label: "Publicar", tone: "success", verbPast: "publicado" },
  unpublish: { label: "Despublicar", tone: "warning", verbPast: "despublicado" },
  rollback: { label: "Revertir", tone: "warning", verbPast: "revertido" },
};

export function getEntityLabel(entityType: string): string {
  return (
    ENTITY_LABELS[entityType] ??
    entityType
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
