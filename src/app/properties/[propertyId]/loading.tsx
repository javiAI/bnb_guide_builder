/**
 * Generic loading skeleton for every operator sub-page. Renders instantly while
 * the next page's RSC payload + DB queries resolve, replacing the prior "blank
 * frozen UI" wait that happens on a first navigation to a not-yet-cached route.
 */
export default function PropertyLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="animate-pulse">
      <span className="sr-only">Cargando…</span>

      <div className="h-7 w-48 rounded-[var(--radius-md)] bg-[var(--color-background-subtle)]" />
      <div className="mt-3 h-4 w-72 rounded-[var(--radius-md)] bg-[var(--color-background-subtle)]" />

      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 w-full rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)]"
          />
        ))}
      </div>
    </div>
  );
}
