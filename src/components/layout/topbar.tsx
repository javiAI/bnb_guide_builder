"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Eye, Send } from "lucide-react";
import { CommandBarSlot } from "./command-bar-slot";
import { IconButton } from "@/components/ui/icon-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WORKSPACE_NAV, isNavItemActive } from "@/lib/navigation";

const NOTIFICATIONS_PLACEHOLDER_LABEL = "Notificaciones (próximamente)";

interface TopbarProps {
  propertyId: string;
  propertyNickname: string;
  mobileNavSlot?: React.ReactNode;
}

export function Topbar({ propertyId, propertyNickname, mobileNavSlot }: TopbarProps) {
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
          <CommandBarSlot />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <IconButton
            icon={Bell}
            size="sm"
            tone="neutral"
            aria-label={NOTIFICATIONS_PLACEHOLDER_LABEL}
            aria-disabled="true"
            tabIndex={-1}
            title={NOTIFICATIONS_PLACEHOLDER_LABEL}
            className="cursor-default"
          />
          <Link
            href={`/properties/${propertyId}/guest-guide`}
            aria-label="Vista huésped"
            className="recipe-icon-btn-32 hidden h-8 items-center gap-1.5 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 text-[13px] font-medium text-[var(--color-text-secondary)] no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] md:inline-flex"
          >
            <Eye size={14} aria-hidden="true" />
            <span>Vista huésped</span>
          </Link>
          <Link
            href={`/properties/${propertyId}/publishing`}
            aria-label="Publicar"
            className="recipe-icon-btn-32 inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-[10px] bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] no-underline transition-colors hover:bg-[var(--color-action-primary-hover)] hover:text-[var(--color-action-primary-fg)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] sm:w-auto sm:px-3 sm:text-[13px] sm:font-medium"
          >
            <Send size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Publicar</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
