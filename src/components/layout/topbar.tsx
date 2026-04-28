"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandBarSlot } from "./command-bar-slot";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WORKSPACE_NAV } from "@/lib/navigation";

interface TopbarProps {
  propertyId: string;
  propertyNickname: string;
}

export function Topbar({ propertyId, propertyNickname }: TopbarProps) {
  const pathname = usePathname();

  const currentItem = WORKSPACE_NAV.find((item) => {
    const href = item.href(propertyId);
    return item.key === "overview" ? pathname === href : pathname.startsWith(href);
  });

  return (
    <header
      className="sticky top-0 z-10 grid items-center gap-4 border-b border-[var(--color-border-default)] bg-[var(--color-background-page)] px-5"
      style={{
        height: "var(--height-topbar, 56px)",
        gridTemplateColumns: "1fr minmax(280px, 480px) 1fr",
      }}
    >
      {/* Left: breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
        <Link
          href="/"
          className="shrink-0 transition-colors hover:text-[var(--color-text-primary)]"
        >
          Propiedades
        </Link>
        <span aria-hidden="true" className="text-[var(--color-text-subtle)]">/</span>
        <span className="truncate text-[var(--color-text-secondary)]">{propertyNickname}</span>
        {currentItem && currentItem.key !== "overview" && (
          <>
            <span aria-hidden="true" className="shrink-0 text-[var(--color-text-subtle)]">/</span>
            <span className="truncate font-medium text-[var(--color-text-primary)]">
              {currentItem.label}
            </span>
          </>
        )}
      </div>

      {/* Center: command bar slot */}
      <CommandBarSlot />

      {/* Right: actions */}
      <div className="flex items-center justify-end gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
