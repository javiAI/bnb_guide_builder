"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
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
 * Built on Radix Dialog (focus trap, scroll lock, Escape, overlay dismiss for
 * free). The knowledge base it draws on is folded in as a link rather than a
 * separate nav item (it is mostly auto-extracted from the property content).
 */
export function AssistantLauncher({ propertyId, defaultLocale = "es" }: AssistantLauncherProps) {
  const [open, setOpen] = useState(false);

  // ⌘J / Ctrl+J toggles the assistant from anywhere (Radix handles Escape).
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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <IconButton
          icon={Bot}
          size="sm"
          tone="neutral"
          aria-label="Asistente IA"
          aria-expanded={open}
          title="Asistente IA (⌘J)"
        />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--color-background-overlay)]" />
        <Dialog.Content
          aria-label="Asistente IA"
          className="fixed inset-y-0 right-0 z-50 flex w-[min(420px,100vw)] flex-col border-l border-[var(--color-border-default)] bg-[var(--color-background-page)] shadow-[var(--elevation-modal)] focus-visible:outline-none"
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border-default)] px-4 py-3">
            <Dialog.Title className="flex items-center gap-2 text-[14px] font-semibold text-[var(--color-text-primary)]">
              <Bot size={16} aria-hidden="true" className="text-[var(--color-text-muted)]" />
              Asistente IA
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <Link
                href={`/properties/${propertyId}/knowledge`}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-text-link)] hover:underline"
              >
                <BookOpen size={13} aria-hidden="true" />
                Conocimiento
              </Link>
              <Dialog.Close asChild>
                <IconButton icon={X} size="sm" tone="neutral" aria-label="Cerrar asistente" title="Cerrar" />
              </Dialog.Close>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <AssistantChat propertyId={propertyId} defaultLocale={defaultLocale} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
