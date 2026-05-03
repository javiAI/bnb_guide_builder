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
  AlertCircle,
  MapPin,
  BookOpen,
  BookMarked,
  Bot,
  MessageSquare,
  Image,
  Settings2,
  Activity,
  Send,
  CalendarDays,
  Flag,
  BarChart2,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { WORKSPACE_NAV, NAV_GROUP_LABELS, isNavItemActive, type NavItem } from "@/lib/navigation";
import { SectionProgress } from "@/components/section-progress";
import {
  PropertySwitcher,
  type SwitchableProperty,
} from "./property-switcher";

const NAV_ICONS: Partial<Record<string, LucideIcon>> = {
  overview:      LayoutDashboard,
  property:      Home,
  access:        KeyRound,
  contacts:      Phone,
  policies:      ScrollText,
  spaces:        BedDouble,
  systems:       Zap,
  amenities:     Sparkles,
  troubleshooting: AlertCircle,
  "local-guide": MapPin,
  knowledge:     BookOpen,
  "guest-guide": BookMarked,
  ai:            Bot,
  messaging:     MessageSquare,
  media:         Image,
  ops:           Settings2,
  activity:      Activity,
  publishing:    Send,
  reservations:  CalendarDays,
  incidents:     Flag,
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

  const groups = (["content", "outputs", "operations"] as const).map((group) => ({
    key: group,
    label: NAV_GROUP_LABELS[group],
    items: WORKSPACE_NAV.filter((item) => item.group === group),
  }));

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
      <PropertySwitcher
        currentPropertyId={propertyId}
        currentPropertyNickname={propertyNickname}
        properties={workspaceProperties}
      />

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Navegación de propiedad">
        {groups.map((group) => (
          <div key={group.key} className="mt-3.5">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
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
                      className={`flex min-h-[44px] items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium no-underline transition-colors hover:no-underline ${
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
                      <span className="flex-1 truncate">{item.label}</span>
                      {sectionScores?.[item.key] !== undefined && (
                        <SectionProgress score={sectionScores[item.key]} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border-default)] px-3 py-3">
        <Link
          href="/properties/new/welcome"
          className="flex min-h-[44px] items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--color-text-muted)] no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] hover:no-underline"
        >
          <Home size={16} className="shrink-0" aria-hidden="true" />
          <span>Nueva propiedad</span>
        </Link>
      </div>
    </aside>
  );
}
