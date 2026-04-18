import type { GuideItem as GuideItemType } from "@/lib/types/guide-tree";
import {
  resolveDisplayFields,
  resolveDisplayValue,
} from "@/lib/renderers/_guide-display";
import { GuideMediaGallery } from "./guide-media-gallery";

interface Props {
  item: GuideItemType;
}

export function GuideItem({ item }: Props) {
  // Defense in depth: items with `presentationType === "raw"` must never
  // reach the DOM. The upstream `filterRenderableItems` already drops them
  // for guests, but this guard protects against new call sites that forget.
  if (item.presentationType === "raw") return null;
  const displayValue = resolveDisplayValue(item);
  const displayFields = resolveDisplayFields(item);
  return (
    <article className="guide-item" id={`item-${item.id}`}>
      <h3 className="guide-item__label">
        {item.label}
        {item.deprecated && (
          <span className="guide-deprecated" aria-label="taxonomía obsoleta">
            (obsoleto)
          </span>
        )}
      </h3>
      {displayValue && <p className="guide-item__value">{displayValue}</p>}
      {displayFields.length > 0 && (
        <dl className="guide-item__fields">
          {displayFields.map((f, i) => (
            <div key={`${item.id}-f-${i}`}>
              <dt className="guide-item__field-label">{f.label}</dt>
              <dd className="guide-item__field-value">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.children.length > 0 && (() => {
        const renderableChildren = item.children.filter(
          (child) => child.presentationType !== "raw",
        );
        if (renderableChildren.length === 0) return null;
        return (
          <ol className="guide-item__children">
            {renderableChildren.map((child) => {
              const childValue = resolveDisplayValue(child);
              return (
                <li key={child.id}>
                  <strong>{child.label}</strong>
                  {childValue && <> — {childValue}</>}
                </li>
              );
            })}
          </ol>
        );
      })()}
      {item.media.length > 0 && (
        <GuideMediaGallery media={item.media} contextLabel={item.label} />
      )}
    </article>
  );
}
