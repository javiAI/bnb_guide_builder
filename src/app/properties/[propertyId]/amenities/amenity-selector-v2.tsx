"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toggleAmenityAction } from "@/lib/actions/editor.actions";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Tooltip } from "@/components/ui/tooltip";
import { AmenityDetailPanel } from "./amenity-detail-panel";
import type { EnrichedAmenityItem, SpaceSection } from "./page";
import type { ImportanceLevel } from "@/lib/types/taxonomy";

const TIER_CONFIG: { level: ImportanceLevel; label: string; hint: string }[] = [
  { level: "highlight", label: "Esenciales", hint: "Lo que los huéspedes esperan encontrar" },
  { level: "standard", label: "Recomendados", hint: "Mejoran la experiencia" },
  { level: "bonus", label: "Destacados", hint: "Te diferencian de la competencia" },
];

interface AmenitySelectorV2Props {
  propertyId: string;
  generalItems: EnrichedAmenityItem[];
  spaceSections: SpaceSection[];
}

function AmenityChip({
  propertyId,
  item,
  spaceId,
  isExpanded,
  onExpand,
}: {
  propertyId: string;
  item: EnrichedAmenityItem;
  spaceId: string | null;
  isExpanded: boolean;
  onExpand: (key: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const hasDetails = item.hasSubtype && item.subtypeFields.length > 0;
  const expandKey = `${item.id}|${spaceId ?? ""}`;

  function handleToggle() {
    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("amenityKey", item.id);
    formData.set("enabled", String(!item.enabled));
    if (spaceId) formData.set("spaceId", spaceId);

    startTransition(async () => {
      await toggleAmenityAction(null, formData);
    });

    if (item.enabled) onExpand(null);
  }

  function handleClick() {
    if (!item.enabled) {
      handleToggle();
      return;
    }
    if (hasDetails) {
      onExpand(isExpanded ? null : expandKey);
      return;
    }
    handleToggle();
  }

  if (item.enabled) {
    return (
      <Tooltip text={item.description}>
        <span
          className={`inline-flex items-center gap-1 rounded-full border border-[var(--color-primary-500)] bg-[var(--color-primary-500)] px-3 py-1.5 text-xs font-medium text-white ${isPending ? "opacity-50" : ""}`}
        >
          {hasDetails ? (
            <button
              type="button"
              onClick={() => onExpand(isExpanded ? null : expandKey)}
              className="inline-flex items-center gap-1"
            >
              {item.label}
              <span className="text-[10px]">{isExpanded ? "▲" : "▼"}</span>
            </button>
          ) : (
            <span>{item.label}</span>
          )}
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className="ml-0.5 rounded-full p-0.5 hover:bg-white/20 transition-colors"
            aria-label="Quitar"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3">
              <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip text={item.description}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors border-[var(--color-neutral-200)] bg-white text-[var(--color-neutral-600)] hover:border-[var(--color-neutral-300)] ${isPending ? "opacity-50" : ""}`}
      >
        {item.label}
      </button>
    </Tooltip>
  );
}

/** Renders items grouped by importance tier with labels */
function TieredChipGrid({
  propertyId,
  items,
  spaceId,
  expandedDetail,
  onExpand,
}: {
  propertyId: string;
  items: EnrichedAmenityItem[];
  spaceId: string | null;
  expandedDetail: string | null;
  onExpand: (key: string | null) => void;
}) {
  const activeDetailItem = items.find(
    (i) => i.enabled && i.subtypeFields.length > 0 && expandedDetail === `${i.id}|${spaceId ?? ""}`,
  );

  return (
    <>
      {TIER_CONFIG.map(({ level, label, hint }) => {
        const tierItems = items.filter((i) => i.importanceLevel === level);
        if (tierItems.length === 0) return null;
        return (
          <div key={level} className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-neutral-600)] mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-primary-400)] flex-shrink-0" />
              {label}
              <span className="font-normal normal-case tracking-normal text-[var(--color-neutral-500)]">
                — {hint}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {tierItems.map((item) => (
                <AmenityChip
                  key={item.id}
                  propertyId={propertyId}
                  item={item}
                  spaceId={spaceId}
                  isExpanded={expandedDetail === `${item.id}|${spaceId ?? ""}`}
                  onExpand={onExpand}
                />
              ))}
            </div>
          </div>
        );
      })}
      {activeDetailItem && (
        <AmenityDetailPanel
          propertyId={propertyId}
          item={activeDetailItem}
          spaceId={spaceId}
        />
      )}
    </>
  );
}

/** Input to add a custom amenity chip */
function CustomChipInput({
  propertyId,
  spaceId,
}: {
  propertyId: string;
  spaceId: string | null;
}) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    // Custom amenities use "custom." prefix + slugified label
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const amenityKey = `custom.${slug}`;

    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("amenityKey", amenityKey);
    formData.set("enabled", "true");
    if (spaceId) formData.set("spaceId", spaceId);

    startTransition(async () => {
      await toggleAmenityAction(null, formData);
    });
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Añadir otro…"
        className="w-40 rounded-full border border-dashed border-[var(--color-neutral-300)] bg-white px-3 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
      />
      {value.trim() && (
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-[var(--color-primary-500)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
        >
          +
        </button>
      )}
    </form>
  );
}

function countLabel(enabled: number, total: number): string {
  return `${enabled} de ${total}`;
}

export function AmenitySelectorV2({
  propertyId,
  generalItems,
  spaceSections,
}: AmenitySelectorV2Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(["general"]),
  );
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);

  const totalEnabled =
    generalItems.filter((i) => i.enabled).length +
    spaceSections.reduce((sum, s) => sum + s.items.filter((i) => i.enabled).length, 0);

  function toggleSection(id: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-neutral-500)]">
        {totalEnabled} amenities configurados en total
      </p>

      {/* General / property-wide */}
      <CollapsibleSection
        title="General"
        selectedLabel={countLabel(generalItems.filter((i) => i.enabled).length, generalItems.length)}
        expanded={expandedSections.has("general")}
        onToggle={() => toggleSection("general")}
      >
        <p className="mb-3 text-xs text-[var(--color-neutral-500)]">
          Equipamiento que aplica a toda la propiedad.
        </p>
        <TieredChipGrid
          propertyId={propertyId}
          items={generalItems}
          spaceId={null}
          expandedDetail={expandedDetail}
          onExpand={setExpandedDetail}
        />
        <CustomChipInput propertyId={propertyId} spaceId={null} />
      </CollapsibleSection>

      {/* Per-space sections */}
      {spaceSections.map((section) => (
        <CollapsibleSection
          key={section.spaceId}
          title={section.spaceName}
          selectedLabel={countLabel(section.items.filter((i) => i.enabled).length, section.items.length)}
          expanded={expandedSections.has(section.spaceId)}
          onToggle={() => toggleSection(section.spaceId)}
        >
          <TieredChipGrid
            propertyId={propertyId}
            items={section.items}
            spaceId={section.spaceId}
            expandedDetail={expandedDetail}
            onExpand={setExpandedDetail}
          />
          <CustomChipInput propertyId={propertyId} spaceId={section.spaceId} />
        </CollapsibleSection>
      ))}
    </div>
  );
}
