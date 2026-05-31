import { prisma } from "@/lib/db";
import { WORKSPACE_NAV } from "@/lib/navigation";
import {
  findSystemItem,
  findAmenityItem,
  getSpaceTypeLabel,
  findLocalPlaceCategory,
  policyTaxonomy,
} from "@/lib/taxonomy-loader";

/**
 * Operator command-palette search index (Liora 16F.5). A flat, per-property list
 * of everything searchable — sections + the property's configured entities
 * (contacts, spaces, systems, equipamiento, guía local, soluciones) + policy
 * concepts — each with a deep link to the section where it lives. The palette
 * fuzzy-searches this client-side (fuse.js), so "fumar" finds the smoking norm,
 * a name finds its contact, an amenity finds its section, etc.
 *
 * Read-only and derived from existing data; no new model. Per-entity anchors
 * (jumping to a specific row) are a follow-up — results land on the section.
 */
export interface OperatorSearchEntry {
  id: string;
  label: string;
  /** Type/context line shown on the result (e.g. "Contacto", "Norma"). */
  sublabel: string;
  /** Bucket for future grouping. */
  group: string;
  href: string;
  /** Extra searchable text (phone, description, type label…). */
  keywords?: string;
}

export async function getOperatorSearchIndex(
  propertyId: string,
): Promise<OperatorSearchEntry[]> {
  const base = `/properties/${propertyId}`;

  const [contacts, spaces, systems, amenities, places, playbooks] = await Promise.all([
    prisma.contact.findMany({
      where: { propertyId },
      select: {
        id: true,
        displayName: true,
        roleKey: true,
        contactPersonName: true,
        phone: true,
        email: true,
      },
    }),
    prisma.space.findMany({
      where: { propertyId, status: "active" },
      select: { id: true, name: true, spaceType: true },
    }),
    prisma.propertySystem.findMany({
      where: { propertyId },
      select: { id: true, systemKey: true },
    }),
    prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      select: { amenityKey: true },
      distinct: ["amenityKey"],
    }),
    prisma.localPlace.findMany({
      where: { propertyId },
      select: { id: true, name: true, categoryKey: true },
    }),
    prisma.troubleshootingPlaybook.findMany({
      where: { propertyId },
      select: { id: true, playbookKey: true, title: true },
    }),
  ]);

  const entries: OperatorSearchEntry[] = [];

  // Sections (nav) — quick navigation.
  for (const item of WORKSPACE_NAV) {
    entries.push({
      id: `section:${item.key}`,
      label: item.label,
      sublabel: "Sección",
      group: "Secciones",
      href: item.href(propertyId),
    });
  }

  for (const contact of contacts) {
    entries.push({
      id: `contact:${contact.id}`,
      label: contact.displayName,
      sublabel: "Contacto",
      group: "Contactos",
      href: `${base}/contacts`,
      keywords: [contact.contactPersonName, contact.phone, contact.email, contact.roleKey]
        .filter(Boolean)
        .join(" "),
    });
  }

  for (const space of spaces) {
    entries.push({
      id: `space:${space.id}`,
      label: space.name,
      sublabel: "Espacio",
      group: "Espacios",
      href: `${base}/spaces`,
      keywords: getSpaceTypeLabel(space.spaceType, space.spaceType),
    });
  }

  for (const system of systems) {
    const item = findSystemItem(system.systemKey);
    entries.push({
      id: `system:${system.id}`,
      label: item?.label ?? system.systemKey,
      sublabel: "Sistema",
      group: "Sistemas",
      href: `${base}/systems`,
    });
  }

  // Amenities — deduped by key at the DB (`distinct`), since an amenity can be
  // placed in many spaces.
  for (const amenity of amenities) {
    const item = findAmenityItem(amenity.amenityKey);
    entries.push({
      id: `amenity:${amenity.amenityKey}`,
      label: item?.label ?? amenity.amenityKey,
      sublabel: "Equipamiento",
      group: "Equipamiento",
      href: `${base}/amenities`,
    });
  }

  for (const place of places) {
    const category = findLocalPlaceCategory(place.categoryKey);
    entries.push({
      id: `place:${place.id}`,
      label: place.name,
      sublabel: category?.label ? `Guía local · ${category.label}` : "Guía local",
      group: "Guía local",
      href: `${base}/local-guide`,
    });
  }

  for (const playbook of playbooks) {
    entries.push({
      id: `playbook:${playbook.id}`,
      label: playbook.title,
      sublabel: "Solución",
      group: "Soluciones",
      href: `${base}/troubleshooting/${playbook.playbookKey}`,
    });
  }

  // Policy concepts (the taxonomy catalog) → Normas. Makes "fumar", "mascotas",
  // "fiestas"… land on the policies section even before they're filled in.
  for (const group of policyTaxonomy.groups ?? []) {
    for (const item of group.items ?? []) {
      entries.push({
        id: `policy:${item.id}`,
        label: item.label,
        sublabel: "Norma",
        group: "Normas",
        href: `${base}/policies`,
        keywords: item.description ?? undefined,
      });
    }
  }

  return entries;
}
