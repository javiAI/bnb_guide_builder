"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, BookOpen, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { TextLink } from "@/components/ui/text-link";
import { Tooltip } from "@/components/ui/tooltip";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { useDismiss } from "@/lib/use-dismiss";

interface AssistantLauncherProps {
  propertyId: string;
  defaultLocale?: string;
}

/**
 * Floating assistant (Liora 16F.5). The chat is docked in the right rail at xl,
 * so this floating bubble only surfaces it when the rail can't: below xl, or
 * when the rail is collapsed. Visibility is governed by `.shell-chat-bubble` in
 * `shell.css` (hidden at xl unless `html[data-rail-collapsed="true"]`).
 *
 * Unlike a drawer, this is a **non-modal popover**: no overlay, no scroll lock,
 * the page stays usable behind it. Dismiss on outside-click / Escape via
 * `useDismiss`. The chat resumes the most recent conversation on open
 * (`autoResumeLast`) and persists server-side, so closing/reopening continues
 * where you left off; its built-in "Historial"/"Nueva" controls switch threads.
 * ⌘J toggles. The full chat + knowledge page is `/ai`.
 */
export function AssistantLauncher({ propertyId, defaultLocale = "es" }: AssistantLauncherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismiss(open, containerRef, () => setOpen(false));

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

  return (
    <div ref={containerRef} className="shell-chat-bubble fixed bottom-5 right-5 z-40">
      {open && (
        <div
          role="dialog"
          aria-label="Asistente IA"
          className="absolute bottom-full right-0 mb-3 flex h-[min(560px,calc(100vh-9rem))] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-background-page)] shadow-[var(--elevation-modal)]"
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border-default)] px-4 py-3">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--color-text-primary)]">
              <Bot size={16} aria-hidden="true" className="text-[var(--color-text-muted)]" />
              Asistente IA
            </span>
            <div className="flex items-center gap-2">
              <TextLink
                href={`/properties/${propertyId}/ai`}
                onClick={() => setOpen(false)}
                size="sm"
                className="inline-flex items-center gap-1.5"
              >
                <BookOpen size={13} aria-hidden="true" />
                Conocimiento
              </TextLink>
              <Tooltip text="Cerrar">
                <IconButton
                  icon={X}
                  size="sm"
                  tone="neutral"
                  aria-label="Cerrar asistente"
                  onClick={() => setOpen(false)}
                />
              </Tooltip>
            </div>
          </header>
          <div className="min-h-0 flex-1 p-3">
            <AssistantChat propertyId={propertyId} defaultLocale={defaultLocale} fill autoResumeLast />
          </div>
        </div>
      )}

      <Tooltip text="Asistente IA (⌘J)">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? "Cerrar asistente IA" : "Abrir asistente IA"}
          aria-expanded={open}
          className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] shadow-[var(--elevation-modal)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]"
        >
          <Bot size={22} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}
