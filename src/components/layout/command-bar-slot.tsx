import { Search } from "lucide-react";

export function CommandBarSlot() {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 items-center rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-muted)] select-none w-8 justify-center xl:w-full xl:justify-start xl:gap-2.5 xl:px-3"
    >
      <Search size={14} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
      <span className="hidden min-w-0 flex-1 truncate text-[13px] text-[var(--color-text-muted)] xl:inline">
        Buscar (próximamente)
      </span>
      <span className="ml-auto hidden shrink-0 items-center gap-1 xl:flex">
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
