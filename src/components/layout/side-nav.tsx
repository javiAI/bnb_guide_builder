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
import { WORKSPACE_NAV, NAV_GROUP_LABELS, type NavItem } from "@/lib/navigation";
import { SectionProgress } from "@/components/section-progress";

const NAV_ICONS: Record<string, LucideIcon> = {
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
}

function propertyInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

export function SideNav({ propertyId, propertyNickname, sectionScores }: SideNavProps) {
  const pathname = usePathname();

  const groups = (["content", "outputs", "operations"] as const).map((group) => ({
    key: group,
    label: NAV_GROUP_LABELS[group],
    items: WORKSPACE_NAV.filter((item) => item.group === group),
  }));

  function isActive(item: NavItem): boolean {
    const href = item.href(propertyId);
    return item.key === "overview" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside
      className="fixed left-0 top-0 flex h-full flex-col border-r border-[var(--color-border-default)] bg-[var(--color-background-elevated)]"
      style={{ width: "var(--sidebar-width)" }}
    >
      {/* Property badge */}
      <div className="mx-3 my-3.5 flex items-center gap-2.5 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-page)] px-3 py-2.5">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[var(--color-action-primary-subtle)] text-[11px] font-semibold text-[var(--color-action-primary-subtle-fg)]"
          aria-hidden="true"
        >
          {propertyInitials(propertyNickname)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-[16px] text-[var(--color-text-primary)]">
            {propertyNickname}
          </p>
          <Link
            href="/"
            className="text-[11px] leading-[14px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
          >
            ← Propiedades
          </Link>
        </div>
      </div>

      {/* Nav groups */}
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
                      className={`flex min-h-[44px] items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium transition-colors ${
                        active
                          ? "bg-[var(--color-interactive-selected)] text-[var(--color-interactive-selected-fg)]"
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

      {/* Footer */}
      <div className="border-t border-[var(--color-border-default)] px-3 py-3">
        <Link
          href="/properties/new/welcome"
          className="flex min-h-[44px] items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)]"
        >
          <Home size={16} className="shrink-0" aria-hidden="true" />
          <span>Nueva propiedad</span>
        </Link>
      </div>
    </aside>
  );
}
