import { SECTION_EDITORS, getSectionEditor } from "@/config/schemas/section-editors";

export type NavGroup = "content" | "assistant" | "publishing" | "operations";

export interface NavItem {
  key: string;
  label: string;
  href: (propertyId: string) => string;
  group: NavGroup;
}

/**
 * Non-section nav items (no editor section / completeness). `overview` is the
 * dashboard landing; `publishing` is the unified hub (preview + gate + versions
 * + QR); the rest are operations surfaces without a taxonomy-driven editor.
 */
const EXTRA_ITEMS: Record<string, { label: string; group: NavGroup; path: string }> = {
  overview: { label: "Resumen", group: "content", path: "" },
  publishing: { label: "Guía del huésped", group: "publishing", path: "publishing" },
  reservations: { label: "Reservas", group: "operations", path: "reservations" },
  incidents: { label: "Incidencias", group: "operations", path: "incidents" },
  analytics: { label: "Analítica", group: "operations", path: "analytics" },
  settings: { label: "Configuración", group: "operations", path: "settings" },
};

/**
 * Curated operator information architecture (16F.5) — the value chain
 * CONTENIDO → ASISTENTE → PUBLICACIÓN → OPERACIONES. Each key resolves its
 * label / href / group from SECTION_EDITORS (section) or EXTRA_ITEMS
 * (non-section). The order here is the rendered order within each group; the
 * group order is fixed by GROUP_ORDER below.
 *
 * A section editor not listed here (and not `hideFromNav`) still appears —
 * appended to its group end by `buildWorkspaceNav` — so adding a section keeps
 * auto-creating a nav item (config-driven contract). `guest-guide` and
 * `activity` are intentionally absent (they are `hideFromNav`).
 */
const NAV_ORDER: readonly string[] = [
  // CONTENIDO — describe la estancia (identidad → llegada → features → entorno),
  // luego la capa de referencia (soluciones, normas, contactos). Espacios va
  // antes que Sistemas/Equipamiento por dependencia de datos (cobertura por
  // espacio + amenities por espacio).
  "overview",
  "property",
  "access",
  "spaces",
  "systems",
  "amenities",
  "local-guide",
  "troubleshooting",
  "policies",
  "contacts",
  // HUÉSPED — lo que el huésped experimenta: la guía + el asistente IA
  "publishing",
  "ai",
  // OPERACIONES — día a día (Base de conocimiento se pliega en la página /ai;
  // ver section-editors hideFromNav)
  "reservations",
  "messaging",
  "incidents",
  "ops",
  "media",
  "analytics",
  "settings",
];

const GROUP_ORDER: readonly NavGroup[] = [
  "content",
  "assistant",
  "publishing",
  "operations",
];

function resolveNavItem(key: string): NavItem | null {
  const extra = EXTRA_ITEMS[key];
  if (extra) {
    return {
      key,
      label: extra.label,
      group: extra.group,
      href: (id) => `/properties/${id}${extra.path ? `/${extra.path}` : ""}`,
    };
  }
  const section = getSectionEditor(key);
  if (!section || section.hideFromNav) return null;
  return {
    key,
    label: section.label,
    group: section.group as NavGroup,
    href: (id) => `/properties/${id}/${section.key}`,
  };
}

function buildWorkspaceNav(): NavItem[] {
  const placed = new Set<string>(NAV_ORDER);
  const items: NavItem[] = [];

  for (const key of NAV_ORDER) {
    const item = resolveNavItem(key);
    if (item) items.push(item);
  }

  // Auto-create fallback: any non-hidden section editor not explicitly placed
  // is appended to its group end — preserves the "adding a section creates a
  // nav item" contract without forcing a NAV_ORDER edit.
  for (const section of SECTION_EDITORS) {
    if (placed.has(section.key) || section.hideFromNav) continue;
    items.push({
      key: section.key,
      label: section.label,
      group: section.group as NavGroup,
      href: (id) => `/properties/${id}/${section.key}`,
    });
  }

  return GROUP_ORDER.flatMap((group) => items.filter((item) => item.group === group));
}

export const WORKSPACE_NAV: NavItem[] = buildWorkspaceNav();

// overview uses exact-match; all other items use prefix-match (they have sub-routes).
export function isNavItemActive(item: NavItem, pathname: string, propertyId: string): boolean {
  const href = item.href(propertyId);
  return item.key === "overview" ? pathname === href : pathname.startsWith(href);
}

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  content: "Contenido",
  // "assistant" no tiene ítems (ai/knowledge se reasignaron al grupo
  // "publishing" = "Huésped"); SideNav filtra grupos vacíos. Label conservado
  // para el tipo.
  assistant: "Asistente",
  publishing: "Huésped",
  operations: "Operaciones",
};
