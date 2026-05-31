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
 * The operator module container. Renders the shared sticky `<PageHeader>` plus
 * the page body. Width, horizontal gutters and bottom padding are owned by the
 * `AppShell` content wrapper (the fluid `--content-max` column) so every
 * operator surface — whether it builds its header via this primitive or uses
 * `<PageHeader>` directly inside a form — shares the same silhouette: identical
 * header grammar, identical width, identical sticky-under-topbar behaviour.
 *
 * Use this for pages that build their header inline; pages whose header already
 * lives in a `<PageHeader>` (e.g. content-module forms) inherit the same
 * behaviour without wrapping.
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
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        chips={chips}
        actions={actions}
      />
      <div className={cn(className)}>{children}</div>
    </>
  );
}
