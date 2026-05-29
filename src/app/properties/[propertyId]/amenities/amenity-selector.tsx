"use client";

import { useState } from "react";
import { AmenitiesToolbar } from "./_components/amenities-toolbar";
import { EqGroupBand } from "./_components/eq-group-band";
import { DerivedBand } from "./_components/derived-band";
import { TIER_ORDER } from "./_components/eq-tier";
import type { EnrichedAmenityItem, SpaceSection, DerivedAmenityItem } from "./page";

const GENERAL_ADD_ID = "eq-add-general";

/** Accent-insensitive, lowercase fold for client-side search (both sides). */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

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
    return [...items]
      .filter((i) => !onlyConfigured || i.enabled)
      .filter(
        (i) =>
          q === "" ||
          fold(i.label).includes(q) ||
          (i.description ? fold(i.description).includes(q) : false),
      )
      .sort((a, b) => TIER_ORDER[a.importanceLevel] - TIER_ORDER[b.importanceLevel]);
  }

  const renderedGroups = groups
    .map((g) => ({ ...g, visible: visibleItems(g.items) }))
    .filter((g) => g.visible.length > 0);

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

      {renderedGroups.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          {onlyConfigured && query.trim() === ""
            ? "Aún no hay equipamiento configurado."
            : "No hay equipamiento que coincida con la búsqueda."}
        </p>
      )}

      <DerivedBand items={generalDerived} />
    </div>
  );
}
