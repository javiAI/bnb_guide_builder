"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { NotificationsPopover } from "./notifications-popover";
import { AssistantLauncher } from "./assistant-launcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WORKSPACE_NAV, isNavItemActive } from "@/lib/navigation";
import type { OperatorNotification } from "@/lib/services/operator-notifications.service";

interface TopbarProps {
  propertyId: string;
  propertyNickname: string;
  notifications: OperatorNotification[];
  mobileNavSlot?: React.ReactNode;
}

export function Topbar({
  propertyId,
  propertyNickname,
  notifications,
  mobileNavSlot,
}: TopbarProps) {
  const pathname = usePathname();

  const currentItem = WORKSPACE_NAV.find((item) =>
    isNavItemActive(item, pathname, propertyId),
  );

  return (
    <header
      className="sticky top-0 z-30 flex items-center border-b border-[var(--color-border-default)] bg-[var(--color-background-page)]"
      style={{ height: "var(--topbar-height)" }}
    >
      <div
        className="hidden h-full shrink-0 items-center border-r border-[var(--color-border-default)] px-5 lg:flex"
        style={{ width: "var(--sidebar-width)" }}
        aria-hidden="true"
      />

      <div className="flex flex-1 min-w-0 items-center gap-2 px-3 sm:px-4 lg:px-5">
        {mobileNavSlot}

        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] xl:flex-[2_1_0%]">
          <Link
            href="/"
            className="hidden shrink-0 transition-colors hover:text-[var(--color-text-primary)] md:inline"
          >
            Propiedades
          </Link>
          <span aria-hidden="true" className="hidden text-[var(--color-text-subtle)] md:inline">/</span>
          <span className="truncate text-[var(--color-text-secondary)]">{propertyNickname}</span>
          {currentItem && currentItem.key !== "overview" && (
            <>
              <span aria-hidden="true" className="hidden shrink-0 text-[var(--color-text-subtle)] md:inline">/</span>
              <span className="hidden truncate font-medium text-[var(--color-text-primary)] md:inline">
                {currentItem.label}
              </span>
            </>
          )}
        </div>

        <div className="hidden shrink min-w-0 sm:block xl:flex-[1_1_280px] xl:max-w-[440px]">
          <CommandPalette propertyId={propertyId} />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <AssistantLauncher propertyId={propertyId} />
          <NotificationsPopover notifications={notifications} />
          {/* "Vista huésped" lives in the rail; surfaced here only when the rail
              is collapsed (xl+) or absent (below xl) — see src/styles/shell.css. */}
          <Link
            href={`/properties/${propertyId}/guest-guide`}
            aria-label="Vista huésped"
            className="recipe-icon-btn-32 shell-guest-view-btn hidden h-8 items-center gap-1.5 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 text-[13px] font-medium text-[var(--color-text-secondary)] no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] sm:inline-flex"
          >
            <Eye size={14} aria-hidden="true" />
            <span>Vista huésped</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
