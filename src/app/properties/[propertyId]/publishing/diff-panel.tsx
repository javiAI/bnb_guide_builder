import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { composeGuide } from "@/lib/services/guide-rendering.service";
import { computeGuideDiff } from "@/lib/services/guide-diff.service";
import type { GuideTree } from "@/lib/types/guide-tree";
import { GuideDiffViewer } from "./guide-diff-viewer";

interface DiffPanelProps {
  propertyId: string;
  publishedVersionLabel: string;
  publicSlug: string | null;
}

export async function DiffPanel({
  propertyId,
  publishedVersionLabel,
  publicSlug,
}: DiffPanelProps) {
  const [published, liveTree] = await Promise.all([
    prisma.guideVersion.findFirst({
      where: { propertyId, status: "published", treeJson: { not: Prisma.AnyNull } },
      orderBy: { version: "desc" },
      select: { treeJson: true },
    }),
    composeGuide(propertyId, "internal", publicSlug),
  ]);
  if (!published?.treeJson) return null;

  const publishedTree = published.treeJson as unknown as GuideTree;
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
