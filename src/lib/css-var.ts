export function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// MapLibre's paint expressions don't parse oklch() / color-mix() / etc — only
// hex, rgb(a), and named colors. Design tokens that resolve to oklch must be
// flattened to rgb before reaching the GL renderer. Canvas 2D's fillStyle
// accepts any CSS color string and the drawn pixel is readable as rgba.
export function resolveCssColor(value: string): string {
  if (!value) return value;
  if (typeof document === "undefined") return value;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return value;
  try {
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a < 255
      ? `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
      : `rgb(${r},${g},${b})`;
  } catch {
    return value;
  }
}
