import maplibregl from "maplibre-gl";

/**
 * Add a compact AttributionControl that starts (and stays) collapsed.
 *
 * MapLibre's compact AttributionControl ships EXPANDED on mount and re-expands
 * on every style/source change. We close it on mount + after load/styledata so
 * the "OpenStreetMap contributors" banner is unobtrusive. No MutationObserver —
 * watching the control's subtree while writing back to it can trip a ping-pong
 * loop against MapLibre's own DOM updates.
 *
 * Returns a disposer that cancels the pending rAF; call it from the map effect's
 * cleanup (the `map.on` listeners are torn down by `map.remove()`).
 */
export function addCollapsedAttribution(map: maplibregl.Map): () => void {
  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
  const collapse = () => {
    map.getContainer().querySelectorAll(".maplibregl-ctrl-attrib").forEach((el) => {
      if (el instanceof HTMLDetailsElement && el.open) el.open = false;
      if (el.classList.contains("maplibregl-compact-show")) {
        el.classList.remove("maplibregl-compact-show");
      }
    });
  };
  collapse();
  const rafId = requestAnimationFrame(collapse);
  map.on("load", collapse);
  map.on("styledata", collapse);
  return () => cancelAnimationFrame(rafId);
}
