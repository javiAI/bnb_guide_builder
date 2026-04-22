import type { GuideTree } from "@/lib/types/guide-tree";
import type {
  GuideLocalEventsData,
  GuideMapData,
} from "@/lib/types/guide-map";
import type { GuideSearchIndex } from "@/lib/types/guide-search-hit";
import { getBrandPair } from "@/config/brand-palette";
import {
  filterRenderableItems,
  shouldHideSection,
} from "@/lib/renderers/_guide-display";
import { GuideBrandHeader } from "./guide-brand-header";
import { GuideToc, type GuideTocEntry } from "./guide-toc";
import { GuideSearch } from "./guide-search";
import { IssueReporter } from "./issue-reporter";
import { GuideLocalSection } from "./guide-local-section";
import { getPublicSectionComponent } from "./public-guide-section-registry";
import "./guide.css";

interface Props {
  tree: GuideTree;
  propertyTitle: string;
  searchIndex: GuideSearchIndex;
  slug: string;
  mapData?: GuideMapData | null;
  eventsData?: GuideLocalEventsData;
}

export function GuideRenderer({
  tree,
  propertyTitle,
  searchIndex,
  slug,
  mapData = null,
  eventsData = { items: [] },
}: Props) {
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
      <GuideBrandHeader title={propertyTitle} logoUrl={tree.brandLogoUrl}>
        <div className="guide-brand-header__actions">
          <GuideSearch index={searchIndex} slug={slug} />
          <IssueReporter slug={slug} />
        </div>
      </GuideBrandHeader>
      <div className="guide-layout">
        <GuideToc entries={tocEntries} />
        <main className="guide-sections">
          {visibleSections.map(({ section, renderable }) => {
            // `local` has two extra data props (spatial map + temporal events)
            // that no other section needs. Routing it here avoids polluting
            // the shared `PublicSectionComponent` contract with optionals that
            // every renderer would have to ignore.
            if (section.resolverKey === "local") {
              return (
                <GuideLocalSection
                  key={section.id}
                  section={section}
                  renderable={renderable}
                  audience={tree.audience}
                  mapData={mapData}
                  eventsData={eventsData}
                />
              );
            }
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
