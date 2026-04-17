import type { GuideTree } from "@/lib/types/guide-tree";
import { getBrandPair } from "@/config/brand-palette";
import { GuideBrandHeader } from "./guide-brand-header";
import { GuideToc, type GuideTocEntry } from "./guide-toc";
import { getPublicSectionComponent } from "./public-guide-section-registry";
import "./guide.css";

interface Props {
  tree: GuideTree;
  propertyTitle: string;
}

/**
 * Top-level React server component for `/g/:slug`. Consumes a filtered
 * `GuideTree` and delegates each section to the registered component. Brand
 * palette resolves from `tree.brandPaletteKey` (curated set in
 * `src/config/brand-palette.ts`) and is injected as CSS custom properties
 * scoped to `.guide-root` — avoids the FOUC of a client-side theme script.
 *
 * Sections flagged `isAggregator` (currently only `gs.essentials`) are
 * excluded from the TOC: they clone items from other sections, so linking
 * both would double-count navigation entries.
 */
export function GuideRenderer({ tree, propertyTitle }: Props) {
  const pair = getBrandPair(tree.brandPaletteKey ?? null);

  const tocEntries: GuideTocEntry[] = tree.sections
    .filter((s) => !s.isAggregator)
    .map((s) => ({ id: s.id, label: s.label }));

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
          {tree.sections.map((section) => {
            const Component = getPublicSectionComponent(section.resolverKey);
            return <Component key={section.id} section={section} />;
          })}
        </main>
      </div>
    </div>
  );
}
