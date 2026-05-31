"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, BookOpen, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { AssistantChat } from "@/components/assistant/AssistantChat";

interface AssistantLauncherProps {
  propertyId: string;
  defaultLocale?: string;
}

/**
 * Persistent AI assistant (Liora 16F.5). The assistant is a companion tool you
 * consult while working, not a nav destination — so it lives as a topbar
 * launcher + a right-side drawer reachable from every operator surface (⌘J).
 * The knowledge base it draws on is folded in here as a link rather than a
 * separate nav item (it is mostly auto-extracted from the property content).
 */
export function AssistantLauncher({ propertyId, defaultLocale = "es" }: AssistantLauncherProps) {
  const [open, setOpen] = useState(false);

  // ⌘J / Ctrl+J toggles the assistant from anywhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Escape closes when open.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <IconButton
        icon={Bot}
        size="sm"
        tone="neutral"
        onClick={() => setOpen(true)}
        aria-label="Asistente IA"
        aria-expanded={open}
        title="Asistente IA (⌘J)"
      />

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[var(--color-background-overlay)]"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Asistente IA"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(420px,100vw)] flex-col border-l border-[var(--color-border-default)] bg-[var(--color-background-page)] shadow-[var(--elevation-modal)]"
          >
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border-default)] px-4 py-3">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--color-text-primary)]">
                <Bot size={16} aria-hidden="true" className="text-[var(--color-text-muted)]" />
                Asistente IA
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/properties/${propertyId}/knowledge`}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-text-link)] hover:underline"
                >
                  <BookOpen size={13} aria-hidden="true" />
                  Conocimiento
                </Link>
                <IconButton
                  icon={X}
                  size="sm"
                  tone="neutral"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar asistente"
                  title="Cerrar"
                />
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <AssistantChat propertyId={propertyId} defaultLocale={defaultLocale} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
