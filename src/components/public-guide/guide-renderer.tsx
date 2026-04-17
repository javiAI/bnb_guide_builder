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

export function GuideRenderer({ tree, propertyTitle }: Props) {
  const pair = getBrandPair(tree.brandPaletteKey ?? null);

  // Aggregator sections clone items from other sections — listing both in the
  // TOC would double-count navigation entries to the same content.
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
