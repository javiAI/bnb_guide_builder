// Single source of the "property" map marker — a teardrop carrying a Lucide
// `Home` glyph, anchored at its tip. Used by both the Access cockpit map (the
// property anchor among parking/arrival pins) and the Propiedad location map so
// the property reads identically wherever it appears. Built as a detached DOM
// node because MapLibre markers take an HTMLElement, not React.
//
// Pair it with MapLibre's `anchor: "bottom"` so the teardrop tip sits on the
// geographic point. Colors are semantic tokens (action-primary fill +
// text-on-accent stroke/glyph), both defined for light and dark.

const SIZE = 36;
const HEIGHT = Math.round(SIZE * 1.25); // teardrop is taller than wide (tapered tail)

// Inline Lucide `Home` glyph (currentColor stroke) — sits inside the teardrop
// head so the property reads as "home".
const HOME_GLYPH = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

export function createPropertyPinElement(
  opts: { label?: string; clickable?: boolean } = {},
): HTMLDivElement {
  const { label, clickable = false } = opts;
  const el = document.createElement("div");
  el.style.width = `${SIZE}px`;
  el.style.height = `${HEIGHT}px`;
  el.style.position = "relative";
  el.style.cursor = clickable ? "pointer" : "default";
  el.style.outlineOffset = "2px";
  el.style.color = "var(--color-text-on-accent)";
  el.style.filter = "drop-shadow(var(--shadow-md))";
  // Teardrop SVG (single path: round head + tapered tail). The icon overlays
  // the head via absolute positioning so the SVG itself stays anchored to the
  // marker's geographic point (tip at (0,0) in the SVG's coordinate system).
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${HEIGHT}" viewBox="0 0 24 30" aria-hidden="true" style="position:absolute;inset:0;">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 7.5 9 16 11.3 18 .4.3 1 .3 1.4 0C15 28 24 19.5 24 12 24 5.4 18.6 0 12 0Z" fill="var(--color-action-primary)" stroke="var(--color-text-on-accent)" stroke-width="1.5"/>
    </svg>
    <span style="position:absolute;top:5px;left:0;right:0;display:grid;place-items:center;height:24px;color:var(--color-text-on-accent);">${HOME_GLYPH}</span>
  `;
  if (label) {
    el.title = label;
    el.setAttribute("aria-label", label);
  }
  return el;
}
