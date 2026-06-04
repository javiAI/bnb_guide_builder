import { flushSync } from "react-dom";

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => {
    ready?: Promise<unknown>;
    updateCallbackDone?: Promise<unknown>;
    finished?: Promise<unknown>;
  };
};

/**
 * Run a state update inside a View Transition so the browser morphs the
 * before/after layout (size + position) smoothly — the same mechanism the
 * access cockpit uses for its card expansion. `flushSync` forces React to
 * commit synchronously so the "after" snapshot is captured against the new DOM.
 *
 * Falls back to a plain update when the API is unavailable (older browsers,
 * SSR) — the change still applies, just without the animation. The three
 * transition promises reject with AbortError when a newer transition
 * interrupts this one; we swallow them so they don't surface as unhandled.
 */
export function withViewTransition(update: () => void): void {
  const doc = (typeof document !== "undefined" ? document : null) as DocWithVT | null;
  if (!doc || typeof doc.startViewTransition !== "function") {
    update();
    return;
  }
  const transition = doc.startViewTransition(() => flushSync(update));
  transition.ready?.catch(() => {});
  transition.updateCallbackDone?.catch(() => {});
  transition.finished?.catch(() => {});
}
