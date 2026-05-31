"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Bell, Flag, TriangleAlert, type LucideIcon } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useDismiss } from "@/lib/use-dismiss";
import type {
  OperatorNotification,
  OperatorNotificationKind,
} from "@/lib/services/operator-notifications.service";

const KIND_CONFIG: Record<
  OperatorNotificationKind,
  { icon: LucideIcon; iconClass: string }
> = {
  blocker: { icon: TriangleAlert, iconClass: "text-[var(--color-status-error-text)]" },
  incident: { icon: Flag, iconClass: "text-[var(--color-status-warning-text)]" },
};

interface NotificationsPopoverProps {
  notifications: OperatorNotification[];
}

/**
 * Topbar notification feed (Liora 16F.5). Aggregates publish blockers + open
 * incidents (server-derived in AppShell, passed as a prop). Lightweight
 * click-outside + Escape dropdown — Radix has no popover primitive installed and
 * a modal Dialog is the wrong affordance for a glanceable feed.
 */
export function NotificationsPopover({ notifications }: NotificationsPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = notifications.length;
  const label = count > 0 ? `Notificaciones (${count})` : "Notificaciones";

  useDismiss(open, ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <IconButton
        icon={Bell}
        iconSize={15}
        size="sm"
        tone="neutral"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={label}
        aria-expanded={open}
        title={label}
      />
      {count > 0 && (
        <span className="pointer-events-none absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-[var(--color-status-error-solid)] px-1 text-[10px] font-semibold leading-none text-[var(--color-status-error-solid-fg)]">
          {count > 9 ? "9+" : count}
        </span>
      )}

      {open && (
        <div
          role="menu"
          aria-label="Notificaciones"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] shadow-[var(--elevation-popover)]"
        >
          <div className="border-b border-[var(--color-border-subtle)] px-4 py-3">
            <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              Notificaciones
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              Bloqueos de publicación e incidencias abiertas
            </p>
          </div>

          {count === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]">
              Todo en orden. Sin avisos pendientes.
            </p>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto py-1">
              {notifications.map((notification) => {
                const { icon: Icon, iconClass } = KIND_CONFIG[notification.kind];
                return (
                  <li key={notification.id}>
                    <Link
                      href={notification.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-[44px] items-start gap-2.5 px-4 py-2.5 no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:no-underline"
                    >
                      <Icon
                        size={15}
                        aria-hidden="true"
                        className={`mt-0.5 shrink-0 ${iconClass}`}
                      />
                      <span className="flex-1 text-[13px] leading-[1.4] text-[var(--color-text-secondary)]">
                        {notification.title}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
