import { filterByAudience } from "@/lib/services/guide-rendering.service";
import { normalizeGuideForPresentation } from "@/lib/services/guide-presentation.service";
import { buildGuideSearchIndex } from "@/lib/services/guide-search-index.service";
import type { GuideTree } from "@/lib/types/guide-tree";
import type { GuideSearchIndex } from "@/lib/types/guide-search-hit";

/** Single source of truth for "given a raw GuideTree, produce the
 * guest-facing tree + search index". Identical sequence is required by
 * `/g/[slug]/page.tsx`, `/g/[slug]/sw.js/route.ts`, and the parallel E2E
 * routes — keeping it inline drifts the `audience: "guest"` and
 * `emptyCtaDeepLink: null` invariants across copies. */
export function buildGuestPresentationLayer(rawTree: GuideTree): {
  guestTree: GuideTree;
  searchIndex: GuideSearchIndex;
} {
  const filteredTree: GuideTree = {
    ...rawTree,
    audience: "guest",
    sections: rawTree.sections.map((section) => ({
      ...section,
      emptyCtaDeepLink: null,
      items: filterByAudience(section.items, "guest"),
    })),
  };
  const guestTree = normalizeGuideForPresentation(filteredTree, "guest");
  const searchIndex = buildGuideSearchIndex(guestTree);
  return { guestTree, searchIndex };
}
