import { composeGuide } from "@/lib/services/guide-rendering.service";
import { computeGuideDiff } from "@/lib/services/guide-diff.service";
import type { GuideTree } from "@/lib/types/guide-tree";
import { GuideDiffViewer } from "./guide-diff-viewer";

interface DiffPanelProps {
  propertyId: string;
  publishedVersionLabel: string;
  publicSlug: string | null;
  /** Snapshot tree of the currently published version. Loaded by the parent
   * page in its parallel fetch batch so this panel does not re-query. */
  publishedTree: GuideTree;
}

export async function DiffPanel({
  propertyId,
  publishedVersionLabel,
  publicSlug,
  publishedTree,
}: DiffPanelProps) {
  const liveTree = await composeGuide(propertyId, "internal", publicSlug);
  const diff = computeGuideDiff(publishedTree, liveTree);

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
        Cambios desde {publishedVersionLabel}
      </h2>
      <GuideDiffViewer diff={diff} />
    </div>
  );
}

export function DiffPanelSkeleton() {
  return (
    <div className="mt-8">
      <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Cambios</h2>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-xs text-[var(--color-neutral-500)]">
        Calculando diferencias…
      </div>
    </div>
  );
}
