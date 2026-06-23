"use client";

import { useState } from "react";
import { Sofa } from "lucide-react";
import { NumberedSection } from "@/components/ui/numbered-section";
import { AmenitiesToolbar } from "./_components/amenities-toolbar";
import { EqGroupBand } from "./_components/eq-group-band";
import { DerivedBand } from "./_components/derived-band";
import { CustomAmenitySection } from "./_components/custom-amenity-section";
import { TIER_META } from "./_components/eq-tier";
import { fold } from "./_components/text";
import type {
  EnrichedAmenityItem,
  SpaceSection,
  DerivedAmenityItem,
  CustomAmenityEntry,
} from "./page";

const CUSTOM_ADD_INPUT_ID = "eq-add-custom";

interface AmenitySelectorProps {
  propertyId: string;
  generalItems: EnrichedAmenityItem[];
  generalDerived: DerivedAmenityItem[];
  spaceSections: SpaceSection[];
  customEntries: CustomAmenityEntry[];
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
  customEntries,
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

  // The derived section follows the same search (label or source summary). It
  // is not affected by "Solo disponibles" — derived state is reference, not an
  // operator-configured value.
  const visibleDerived = generalDerived.filter(
    (d) =>
      q === "" ||
      fold(d.label).includes(q) ||
      (d.status.sourceSummary ? fold(d.status.sourceSummary).includes(q) : false),
  );

  function handleAdd() {
    // The free-label add control lives in section 02 — scroll to it and focus.
    const el = document.getElementById(CUSTOM_ADD_INPUT_ID);
    if (el instanceof HTMLInputElement) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <div>
      <NumberedSection number="01" title="Catálogo">
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
          />
        ))}

        {renderedGroups.length === 0 &&
          (groups.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] px-8 py-12 text-center">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[var(--color-action-primary-subtle)]">
                <Sofa
                  size={20}
                  aria-hidden="true"
                  className="text-[var(--color-action-primary)]"
                />
              </div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Aún no hay equipamiento
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--color-text-secondary)]">
                El catálogo se construye a partir de tus espacios. Añade el
                primero en Espacios y aquí aparecerá su equipamiento.
              </p>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
              {onlyConfigured && query.trim() === ""
                ? "Aún no hay equipamiento disponible."
                : "No hay equipamiento que coincida con la búsqueda."}
            </p>
          ))}
      </NumberedSection>

      <NumberedSection number="02" title="Equipamiento propio">
        <CustomAmenitySection
          propertyId={propertyId}
          entries={customEntries}
          spaces={spaceSections.map((s) => ({ id: s.spaceId, name: s.spaceName }))}
          inputId={CUSTOM_ADD_INPUT_ID}
        />
      </NumberedSection>

      {visibleDerived.length > 0 && (
        <NumberedSection number="03" title="Derivado de otros módulos">
          <DerivedBand items={visibleDerived} />
        </NumberedSection>
      )}
    </div>
  );
}
