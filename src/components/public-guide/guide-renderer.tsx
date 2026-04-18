import type { GuideTree } from "@/lib/types/guide-tree";
import { getBrandPair } from "@/config/brand-palette";
import {
  filterRenderableItems,
  shouldHideSection,
} from "@/lib/renderers/_guide-display";
import { GuideBrandHeader } from "./guide-brand-header";
import { GuideToc, type GuideTocEntry } from "./guide-toc";
import { getPublicSectionComponent } from "./public-guide-section-registry";
import "./guide.css";

interface Props {
  tree: GuideTree;
  propertyTitle: string;
}

export function GuideRenderer({ tree, propertyTitle }: Props) {
  const pair = getBrandPair(tree.brandPaletteKey ?? null);

  // Drop sections marked `hideWhenEmptyForGuest` that have no renderable
  // items (invariant 3 — empty-state gating). We keep the filtered list so
  // each section renderer reuses it instead of re-running the same filter.
  const visibleSections = tree.sections
    .map((section) => ({
      section,
      renderable: filterRenderableItems(section.items, tree.audience),
    }))
    .filter(
      ({ section, renderable }) =>
        !shouldHideSection(section, tree.audience, renderable),
    );

  // Aggregator sections clone items from other sections — listing both in the
  // TOC would double-count navigation entries to the same content.
  const tocEntries: GuideTocEntry[] = visibleSections
    .filter(({ section }) => !section.isAggregator)
    .map(({ section }) => ({ id: section.id, label: section.label }));

  return (
    <div
      className="guide-root"
      style={
        {
          "--guide-brand-light": pair.light,
          "--guide-brand-dark": pair.dark,
        } as React.CSSProperties
      }
    >
      <GuideBrandHeader title={propertyTitle} logoUrl={tree.brandLogoUrl} />
      <div className="guide-layout">
        <GuideToc entries={tocEntries} />
        <main className="guide-sections">
          {visibleSections.map(({ section, renderable }) => {
            const Component = getPublicSectionComponent(section.resolverKey);
            return (
              <Component
                key={section.id}
                section={section}
                renderable={renderable}
                audience={tree.audience}
                tree={tree}
              />
            );
          })}
        </main>
      </div>
    </div>
  );
}
