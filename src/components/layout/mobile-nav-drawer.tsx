"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { SideNav } from "./side-nav";
import type { SwitchableProperty } from "./property-switcher";

interface MobileNavDrawerProps {
  propertyId: string;
  propertyNickname: string;
  sectionScores?: Record<string, number>;
  workspaceProperties: SwitchableProperty[];
}

export function MobileNavDrawer({
  propertyId,
  propertyNickname,
  sectionScores,
  workspaceProperties,
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir navegación"
        aria-expanded={open}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] lg:hidden"
      >
        <Menu size={15} aria-hidden="true" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[var(--color-background-overlay)] lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="lg:hidden" role="dialog" aria-modal="true" aria-label="Navegación">
            <SideNav
              propertyId={propertyId}
              propertyNickname={propertyNickname}
              sectionScores={sectionScores}
              workspaceProperties={workspaceProperties}
              variant="drawer"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar navegación"
              className="fixed z-[60] grid h-8 w-8 place-items-center rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
              style={{
                left: "calc(var(--sidebar-width) - 40px)",
                top: "calc(var(--topbar-height) + 8px)",
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </>
  );
}
