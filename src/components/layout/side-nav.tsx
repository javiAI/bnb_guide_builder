"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WORKSPACE_NAV, NAV_GROUP_LABELS, type NavItem } from "@/lib/navigation";

interface SideNavProps {
  propertyId: string;
  propertyNickname: string;
}

export function SideNav({ propertyId, propertyNickname }: SideNavProps) {
  const pathname = usePathname();

  const groups = (["content", "outputs", "operations"] as const).map((group) => ({
    key: group,
    label: NAV_GROUP_LABELS[group],
    items: WORKSPACE_NAV.filter((item) => item.group === group),
  }));

  function isActive(item: NavItem): boolean {
    const href = item.href(propertyId);
    if (item.key === "overview") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="fixed left-0 top-0 flex h-full flex-col border-r border-[var(--border)] bg-[var(--surface-elevated)]"
      style={{ width: "var(--sidebar-width)" }}
    >
      <div className="border-b border-[var(--border)] p-4">
        <Link
          href="/"
          className="text-xs font-medium text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]"
        >
          &larr; Propiedades
        </Link>
        <h2 className="mt-2 truncate text-sm font-semibold text-[var(--foreground)]">
          {propertyNickname}
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.key} className="mb-5">
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-neutral-400)]">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href(propertyId)}
                      className={`block rounded-[var(--radius-sm)] px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-[var(--color-primary-50)] font-medium text-[var(--color-primary-700)]"
                          : "text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-neutral-800)]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
