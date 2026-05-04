"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
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
      <IconButton
        icon={Menu}
        size="md"
        tone="neutral"
        onClick={() => setOpen(true)}
        aria-label="Abrir navegación"
        aria-expanded={open}
        className="shrink-0 lg:hidden"
      />

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
            <IconButton
              icon={X}
              size="md"
              tone="neutral"
              onClick={() => setOpen(false)}
              aria-label="Cerrar navegación"
              className="fixed z-[60]"
              style={{
                left: "calc(var(--sidebar-width) - 40px)",
                top: "calc(var(--topbar-height) + 8px)",
              }}
            />
          </div>
        </>
      )}
    </>
  );
}
