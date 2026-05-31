import { useEffect, useRef, type RefObject } from "react";

/**
 * Dismiss a non-modal popup on outside pointerdown + Escape, while `open`.
 * Shared by the lightweight operator dropdowns (notifications popover, property
 * switcher) so the click-outside/Escape wiring lives in one place.
 *
 * For MODAL surfaces (the assistant drawer, the command palette) use Radix
 * `Dialog` instead — it adds focus trap + scroll lock on top of dismiss.
 *
 * `onClose` is held in a ref so callers can pass an inline closure without the
 * listeners re-subscribing on every render.
 */
export function useDismiss<T extends HTMLElement>(
  open: boolean,
  ref: RefObject<T | null>,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const close = () => onCloseRef.current();
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, ref]);
}
