"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Home,
  KeyRound,
  Phone,
  ScrollText,
  BedDouble,
  Zap,
  Sparkles,
  Wrench,
  MapPin,
  BookOpen,
  MessageSquare,
  Image,
  ClipboardCheck,
  CalendarDays,
  Flag,
  BarChart2,
  Settings,
  type LucideIcon,
} from "lucide-react";
import {
  WORKSPACE_NAV,
  NAV_GROUP_LABELS,
  isNavItemActive,
  type NavItem,
  type NavGroup,
} from "@/lib/navigation";
import { SectionProgress } from "@/components/section-progress";
import { NavResizeHandle } from "./shell-chrome";
import {
  PropertySwitcher,
  type SwitchableProperty,
} from "./property-switcher";

const NAV_ICONS: Partial<Record<string, LucideIcon>> = {
  overview:      LayoutDashboard,
  property:      Home,
  access:        KeyRound,
  spaces:        BedDouble,
  systems:       Zap,
  amenities:     Sparkles,
  "local-guide": MapPin,
  troubleshooting: Wrench,
  policies:      ScrollText,
  contacts:      Phone,
  publishing:    BookOpen,
  reservations:  CalendarDays,
  messaging:     MessageSquare,
  incidents:     Flag,
  ops:           ClipboardCheck,
  media:         Image,
  analytics:     BarChart2,
  settings:      Settings,
};

interface SideNavProps {
  propertyId: string;
  propertyNickname: string;
  sectionScores?: Record<string, number>;
  workspaceProperties: SwitchableProperty[];
  variant?: "desktop" | "drawer";
}

export function SideNav({
  propertyId,
  propertyNickname,
  sectionScores,
  workspaceProperties,
  variant = "desktop",
}: SideNavProps) {
  const pathname = usePathname();

  const groups = (
    ["content", "assistant", "publishing", "operations"] as const satisfies readonly NavGroup[]
  )
    .map((group) => ({
      key: group,
      label: NAV_GROUP_LABELS[group],
      items: WORKSPACE_NAV.filter((item) => item.group === group),
    }))
    // The "assistant" group is empty (ai + knowledge live in the right-side
    // drawer, hideFromNav) — don't render an empty group header.
    .filter((group) => group.items.length > 0);

  function isActive(item: NavItem): boolean {
    return isNavItemActive(item, pathname, propertyId);
  }

  const visibilityClass =
    variant === "desktop" ? "hidden lg:flex" : "flex";

  return (
    <aside
      className={`fixed left-0 z-40 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-background-elevated)] ${visibilityClass}`}
      style={{
        top: "var(--topbar-height)",
        height: "calc(100vh - var(--topbar-height))",
        width: "var(--sidebar-width)",
      }}
    >
      <div className="px-3 py-3">
        <div className="shell-prop-switcher">
          <PropertySwitcher
            currentPropertyId={propertyId}
            currentPropertyNickname={propertyNickname}
            properties={workspaceProperties}
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Navegación de propiedad">
        {groups.map((group) => (
          <div key={group.key} className="mt-3.5">
            <p className="shell-nav-group-label mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item);
                const Icon = NAV_ICONS[item.key];
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href(propertyId)}
                      title={item.label}
                      className={`shell-nav-item flex min-h-[44px] items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium no-underline transition-colors hover:no-underline ${
                        active
                          ? "bg-[var(--color-interactive-selected)] text-[var(--color-interactive-selected-fg)] hover:text-[var(--color-interactive-selected-fg)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {Icon && (
                        <Icon
                          size={16}
                          className={`shrink-0 ${active ? "text-[var(--color-interactive-selected-fg)]" : "text-[var(--color-text-muted)]"}`}
                          aria-hidden="true"
                        />
                      )}
                      <span className="shell-nav-label flex-1 truncate">{item.label}</span>
                      {sectionScores?.[item.key] !== undefined && (
                        <span className="shell-nav-progress">
                          <SectionProgress score={sectionScores[item.key]} />
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border-default)] px-2 py-2">
        <Link
          href="/properties/new/welcome"
          title="Nueva propiedad"
          className="shell-nav-footer-link flex min-h-[44px] items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--color-text-muted)] no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] hover:no-underline"
        >
          <Home size={16} className="shrink-0" aria-hidden="true" />
          <span className="shell-nav-label">Nueva propiedad</span>
        </Link>
      </div>
      {variant === "desktop" && <NavResizeHandle />}
    </aside>
  );
}
