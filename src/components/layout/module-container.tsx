import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";

interface ModuleContainerProps {
  /** Uppercase eyebrow (e.g. "Propiedad · Espacios"). */
  eyebrow?: ReactNode;
  /** Page title (h1). */
  title: ReactNode;
  /** One-line description under the title. */
  description?: ReactNode;
  /** Filter/metadata chips rendered under the description. */
  chips?: ReactNode;
  /** Top-right actions aligned with the title. */
  actions?: ReactNode;
  /** Page body. */
  children: ReactNode;
  /** Extra classes on the body wrapper. */
  className?: string;
}

/**
 * The single operator module container. Every operator page renders its content
 * through this primitive so the header grammar (eyebrow → title → description →
 * chips), the fluid max-width (`--content-max`) and the sticky-under-topbar
 * behaviour are identical across modules — the root cause of header
 * heterogeneity (each page building its own `<header>`) is removed here.
 *
 * The header sticks directly below the topbar on scroll. Its background +
 * bottom hairline bleed to the container edges (`-mx-*` / `px-*`) so content
 * scrolling underneath is fully masked.
 */
export function ModuleContainer({
  eyebrow,
  title,
  description,
  chips,
  actions,
  children,
  className,
}: ModuleContainerProps) {
  return (
    <div className="mx-auto w-full max-w-[var(--content-max)] px-4 pb-12 sm:px-6 lg:px-8">
      <div className="sticky top-[var(--topbar-height)] z-20 -mx-4 border-b border-[var(--color-border-default)] bg-[var(--color-background-page)] px-4 pb-4 pt-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          chips={chips}
          actions={actions}
          showRule={false}
          className="mb-0"
        />
      </div>
      <div className={cn("pt-6", className)}>{children}</div>
    </div>
  );
}
