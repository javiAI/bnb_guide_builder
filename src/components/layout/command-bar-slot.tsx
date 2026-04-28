import { Search } from "lucide-react";

export function CommandBarSlot() {
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-full items-center gap-2.5 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 text-[var(--color-text-muted)] select-none"
    >
      <Search size={14} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-text-muted)]">
        Buscar (próximamente)
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        <kbd className="rounded-[4px] border border-[var(--color-border-default)] bg-[var(--color-background-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-[var(--color-text-secondary)]">
          ⌘
        </kbd>
        <kbd className="rounded-[4px] border border-[var(--color-border-default)] bg-[var(--color-background-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-[var(--color-text-secondary)]">
          K
        </kbd>
      </span>
    </div>
  );
}
