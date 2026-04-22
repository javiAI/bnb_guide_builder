// Shared HTML-entity escape. Lives outside the server-side guide renderer
// so client islands (e.g. `<GuideMap>` building popup HTML) can use it
// without pulling the full HTML-tree renderer into the browser bundle.

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch]);
}
