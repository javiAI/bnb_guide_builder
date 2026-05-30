"use client";

import { useState } from "react";
import { AmenitiesToolbar } from "./_components/amenities-toolbar";
import { EqGroupBand } from "./_components/eq-group-band";
import { DerivedBand } from "./_components/derived-band";
import { TIER_META } from "./_components/eq-tier";
import { fold } from "./_components/text";
import type { EnrichedAmenityItem, SpaceSection, DerivedAmenityItem } from "./page";

const GENERAL_ADD_ID = "eq-add-general";

interface AmenitySelectorProps {
  propertyId: string;
  generalItems: EnrichedAmenityItem[];
  generalDerived: DerivedAmenityItem[];
  spaceSections: SpaceSection[];
}

interface Group {
  key: string;
  title: string;
  spaceId: string | null;
  items: EnrichedAmenityItem[];
}

export function AmenitySelector({
  propertyId,
  generalItems,
  generalDerived,
  spaceSections,
}: AmenitySelectorProps) {
  const [query, setQuery] = useState("");
  const [onlyConfigured, setOnlyConfigured] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);

  const groups: Group[] = [
    { key: "general", title: "General", spaceId: null, items: generalItems },
    ...spaceSections.map((s) => ({
      key: s.spaceId,
      title: s.spaceName,
      spaceId: s.spaceId,
      items: s.items,
    })),
  ].filter((g) => g.items.length > 0);

  const q = fold(query.trim());

  function visibleItems(items: EnrichedAmenityItem[]): EnrichedAmenityItem[] {
    // `.filter()` already returns a fresh array, so the later `.sort()` never
    // mutates the caller's `items` — no defensive copy needed up front.
    return items
      .filter((i) => !onlyConfigured || i.enabled)
      .filter(
        (i) =>
          q === "" ||
          fold(i.label).includes(q) ||
          (i.description ? fold(i.description).includes(q) : false),
      )
      .sort(
        (a, b) =>
          TIER_META[a.importanceLevel].order - TIER_META[b.importanceLevel].order,
      );
  }

  const renderedGroups = groups
    .map((g) => ({ ...g, visible: visibleItems(g.items) }))
    .filter((g) => g.visible.length > 0);

  // The derived band follows the same search (label or source summary). It is
  // not affected by "Sólo configurados" — derived state is reference, not an
  // operator-configured value.
  const visibleDerived = generalDerived.filter(
    (d) =>
      q === "" ||
      fold(d.label).includes(q) ||
      (d.status.sourceSummary ? fold(d.status.sourceSummary).includes(q) : false),
  );
  const showEmpty = renderedGroups.length === 0 && visibleDerived.length === 0;

  function handleAdd() {
    // Reset filters so the destination group is visible, then focus the
    // general custom-add input (simple scroll anchor — no scroll-spy).
    setQuery("");
    setOnlyConfigured(false);
    requestAnimationFrame(() => {
      const el = document.getElementById(GENERAL_ADD_ID);
      if (el instanceof HTMLInputElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    });
  }

  return (
    <div>
      <AmenitiesToolbar
        query={query}
        onQueryChange={setQuery}
        onlyConfigured={onlyConfigured}
        onToggleOnlyConfigured={() => setOnlyConfigured((v) => !v)}
        onAdd={handleAdd}
      />

      {renderedGroups.map((g) => (
        <EqGroupBand
          key={g.key}
          propertyId={propertyId}
          title={g.title}
          spaceId={g.spaceId}
          items={g.visible}
          enabledCount={g.items.filter((i) => i.enabled).length}
          totalCount={g.items.length}
          expandedDetail={expandedDetail}
          onExpand={setExpandedDetail}
          addInputId={g.spaceId === null ? GENERAL_ADD_ID : undefined}
        />
      ))}

      {showEmpty && (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          {onlyConfigured && query.trim() === ""
            ? "Aún no hay equipamiento configurado."
            : "No hay equipamiento que coincida con la búsqueda."}
        </p>
      )}

      <DerivedBand items={visibleDerived} />
    </div>
  );
}
