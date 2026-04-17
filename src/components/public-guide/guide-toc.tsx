"use client";

import { useEffect, useState } from "react";

export interface GuideTocEntry {
  id: string;
  label: string;
}

interface Props {
  entries: GuideTocEntry[];
}

/**
 * Sticky sidebar TOC for the public guide. Highlights the section currently
 * intersecting the viewport using IntersectionObserver (scrollspy). Passed
 * entries are already filtered to exclude aggregator sections — otherwise
 * `gs.essentials` + the sections it clones from would produce duplicate TOC
 * items pointing at different anchors.
 */
export function GuideToc({ entries }: Props) {
  const [activeId, setActiveId] = useState<string | null>(
    entries[0]?.id ?? null,
  );

  useEffect(() => {
    if (entries.length === 0) return;
    const observer = new IntersectionObserver(
      (records) => {
        // Pick the entry closest to the top of the viewport among those
        // currently intersecting. Avoids flickering when multiple sections
        // are simultaneously visible on tall viewports.
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-10% 0px -60% 0px", threshold: 0.01 },
    );
    for (const entry of entries) {
      const el = document.getElementById(entry.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav
      className="guide-toc"
      aria-label="Índice de la guía"
    >
      <ul className="guide-toc__list">
        {entries.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              className="guide-toc__link"
              aria-current={activeId === e.id ? "true" : undefined}
            >
              {e.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
