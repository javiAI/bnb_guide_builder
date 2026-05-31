"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import { WORKSPACE_NAV, NAV_GROUP_LABELS } from "@/lib/navigation";

interface CommandPaletteProps {
  propertyId: string;
}

interface Command {
  key: string;
  label: string;
  group: string;
  href: string;
}

const KBD_CLASS =
  "rounded-[4px] border border-[var(--color-border-default)] bg-[var(--color-background-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-[var(--color-text-secondary)]";

/**
 * Operator command palette (Liora 16F.5). Activates the topbar ⌘K — was a
 * non-interactive slot in 16D. Built on Radix Dialog + fuse.js (no new
 * dependency). v1 scope: navigate to any workspace section; content-level search
 * and server actions are a documented follow-up (docs/FUTURE.md).
 */
export function CommandPalette({ propertyId }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const commands = useMemo<Command[]>(
    () =>
      WORKSPACE_NAV.map((item) => ({
        key: item.key,
        label: item.label,
        group: NAV_GROUP_LABELS[item.group],
        href: item.href(propertyId),
      })),
    [propertyId],
  );

  const fuse = useMemo(
    () => new Fuse(commands, { keys: ["label", "group"], threshold: 0.4 }),
    [commands],
  );

  const results = useMemo<Command[]>(() => {
    const q = query.trim();
    if (!q) return commands;
    return fuse.search(q).map((r) => r.item);
  }, [query, commands, fuse]);

  // ⌘K / Ctrl+K toggles the palette anywhere in the operator shell.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Clearing the query on close cascades into the query effect below, which
  // owns all selection resets — so the first match is always pre-highlighted.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function run(index: number) {
    const command = results[index];
    if (!command) return;
    setOpen(false);
    router.push(command.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(active);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Buscar sección o acción"
          title="Buscar (⌘K)"
          className="recipe-icon-btn-32 flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] xl:w-full xl:justify-start xl:gap-2.5 xl:px-3"
        >
          <Search size={14} aria-hidden="true" className="shrink-0" />
          <span className="hidden min-w-0 flex-1 truncate text-left text-[13px] xl:inline">
            Buscar sección o acción…
          </span>
          <span className="ml-auto hidden shrink-0 items-center gap-1 xl:flex">
            <kbd className={KBD_CLASS}>⌘</kbd>
            <kbd className={KBD_CLASS}>K</kbd>
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--color-background-overlay)]" />
        <Dialog.Content
          aria-label="Buscar sección o acción"
          className="fixed left-1/2 top-[12vh] z-50 w-[min(620px,92vw)] -translate-x-1/2 overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] shadow-[var(--elevation-modal)]"
        >
          <Dialog.Title className="sr-only">Buscar sección o acción</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-[var(--color-border-default)] px-4 py-3">
            <Search size={18} aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- expected for a command palette */}
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Buscar o ir a…"
              aria-label="Buscar sección o acción"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
            />
            <kbd className={KBD_CLASS}>esc</kbd>
          </div>

          <ul className="max-h-[360px] overflow-y-auto p-2">
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-[13px] text-[var(--color-text-muted)]">
                Sin resultados.
              </li>
            ) : (
              results.map((command, index) => (
                <li key={command.key}>
                  <button
                    type="button"
                    onClick={() => run(index)}
                    onMouseEnter={() => setActive(index)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-[8px] px-3 text-left text-[13px] transition-colors ${
                      index === active
                        ? "bg-[var(--color-interactive-hover)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <span className="flex-1 truncate">{command.label}</span>
                    <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                      {command.group}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
