"use client";

import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { AmenityDetailPanel } from "../amenity-detail-panel";
import type { EnrichedAmenityItem } from "../page";
import { EqItemRow, canExpandItem } from "./eq-item-row";

function panelIdFor(itemId: string, spaceId: string | null): string {
  return `eq-panel-${itemId}-${spaceId ?? "general"}`;
}

interface EqGroupBandProps {
  propertyId: string;
  title: string;
  spaceId: string | null;
  /** Rows to render (already filtered + tier-sorted). */
  items: EnrichedAmenityItem[];
  /** Unfiltered group totals for the header count + progress. */
  enabledCount: number;
  totalCount: number;
  expandedDetail: string | null;
  onExpand: (key: string | null) => void;
}

export function EqGroupBand({
  propertyId,
  title,
  spaceId,
  items,
  enabledCount,
  totalCount,
  expandedDetail,
  onExpand,
}: EqGroupBandProps) {
  const pct = totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-3 border-b border-[var(--color-border-default)] py-2.5 pl-3">
        <SectionEyebrow>{title}</SectionEyebrow>
        <span className="text-[11.5px] tabular-nums text-[var(--color-text-muted)]">
          {enabledCount} de {totalCount}
        </span>
        <div
          aria-hidden="true"
          className="h-[3px] max-w-[180px] flex-1 overflow-hidden rounded-full bg-[var(--color-progress-track)]"
        >
          <span
            className="block h-full rounded-full bg-[var(--color-action-primary)] transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div>
        {items.map((item) => {
          const expandKey = `${item.id}|${spaceId ?? ""}`;
          const panelId = panelIdFor(item.id, spaceId);
          const isExpanded = expandedDetail === expandKey;
          const showPanel = isExpanded && canExpandItem(item);
          return (
            <div key={item.id}>
              <EqItemRow
                propertyId={propertyId}
                item={item}
                spaceId={spaceId}
                isExpanded={isExpanded}
                onExpand={onExpand}
                expandKey={expandKey}
                panelId={panelId}
              />
              {showPanel && (
                <div id={panelId} className="pl-3">
                  <AmenityDetailPanel
                    propertyId={propertyId}
                    item={item}
                    spaceId={spaceId}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
