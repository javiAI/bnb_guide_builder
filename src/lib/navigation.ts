import { SECTION_EDITORS } from "@/config/schemas/section-editors";

export interface NavItem {
  key: string;
  label: string;
  href: (propertyId: string) => string;
  group: "content" | "outputs" | "operations";
}

/**
 * Build workspace navigation from the section editor registry.
 * Non-section nav items (overview, publishing, analytics, settings)
 * are added manually since they don't correspond to editor sections.
 */
function buildWorkspaceNav(): NavItem[] {
  const overview: NavItem = {
    key: "overview",
    label: "Resumen",
    href: (id) => `/properties/${id}`,
    group: "content",
  };

  const sectionItems: NavItem[] = SECTION_EDITORS.map((section) => ({
    key: section.key,
    label: section.label,
    href: (id: string) => `/properties/${id}/${section.key}`,
    group: section.group,
  }));

  // Non-section nav items
  const extras: NavItem[] = [
    { key: "publishing", label: "Publicación", href: (id) => `/properties/${id}/publishing`, group: "outputs" },
    { key: "reservations", label: "Reservas", href: (id) => `/properties/${id}/reservations`, group: "operations" },
    { key: "incidents", label: "Incidencias", href: (id) => `/properties/${id}/incidents`, group: "operations" },
    { key: "analytics", label: "Analítica", href: (id) => `/properties/${id}/analytics`, group: "operations" },
    { key: "settings", label: "Configuración", href: (id) => `/properties/${id}/settings`, group: "operations" },
  ];

  // Merge: overview first, then sections and extras ordered by group
  const allItems = [overview, ...sectionItems, ...extras];

  const groupOrder = ["content", "outputs", "operations"] as const;
  return groupOrder.flatMap((group) =>
    allItems.filter((item) => item.group === group),
  );
}

export const WORKSPACE_NAV: NavItem[] = buildWorkspaceNav();

// overview uses exact-match; all other items use prefix-match (they have sub-routes).
export function isNavItemActive(item: NavItem, pathname: string, propertyId: string): boolean {
  const href = item.href(propertyId);
  return item.key === "overview" ? pathname === href : pathname.startsWith(href);
}

export const NAV_GROUP_LABELS: Record<NavItem["group"], string> = {
  content: "Contenido",
  outputs: "Salidas",
  operations: "Operaciones",
};
