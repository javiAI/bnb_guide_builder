import type { GuideItem as GuideItemType } from "@/lib/types/guide-tree";
import { GuideMediaGallery } from "./guide-media-gallery";

interface Props {
  item: GuideItemType;
}

/** Generic GuideItem renderer: label, value, fields, media gallery, and nested
 * children (used by the howto resolver for runbook steps). Specialized
 * section components (emergency, essentials) can wrap or compose this. */
export function GuideItem({ item }: Props) {
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
      {item.value && <p className="guide-item__value">{item.value}</p>}
      {item.fields.length > 0 && (
        <dl className="guide-item__fields">
          {item.fields.map((f, i) => (
            <div key={`${item.id}-f-${i}`}>
              <dt className="guide-item__field-label">{f.label}</dt>
              <dd style={{ margin: 0, display: "inline" }}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.children.length > 0 && (
        <ol className="guide-item__children">
          {item.children.map((child) => (
            <li key={child.id}>
              <strong>{child.label}</strong>
              {child.value && <> — {child.value}</>}
            </li>
          ))}
        </ol>
      )}
      {item.media.length > 0 && (
        <GuideMediaGallery media={item.media} contextLabel={item.label} />
      )}
    </article>
  );
}
