import { useCallback, useEffect, useRef, type RefObject } from "react";

/**
 * Generic auto-save for `<form>` section editors (Liora 16F.5, extended in
 * 16F.6). Edits persist as you make them — like the Acceso section — so there
 * is no "Guardar" button. Drop-in: give the form a ref and call this hook;
 * nothing per-field is needed.
 *
 * Works for `<form action={…}>` and `<form onSubmit={…}>` alike (it calls
 * `requestSubmit()`, which fires whichever the form uses). It's lossless across
 * control styles by combining triggers on the same debounced submit:
 *  - a per-render FormData diff — catches controlled state (text fields,
 *    steppers, radio-cards, map pins, hidden inputs React updates);
 *  - native `input`/`change` listeners — catch uncontrolled fields
 *    (`defaultValue`) that change the DOM without a React re-render;
 *  - an optional `watch` serializer — catches state that never reaches a form
 *    field at all (payloads built state→JSON at submit time, e.g. policies'
 *    `buildPoliciesJson()` or systems' `handleSubmit`). The form's existing
 *    action/onSubmit still does the actual serialisation; `watch` is only the
 *    change signal.
 * Either way it reads the form's live `FormData`, so it never hand-lists fields
 * and never silently drops one. The form's controlled state persists across the
 * action's revalidation, so the post-save render serialises identically and
 * never re-submits (no loop).
 *
 * `requestSubmit()` runs native validation; we gate it on `checkValidity()`
 * first so an invalid form (e.g. an empty required field) is skipped silently
 * until valid — no browser validation bubbles flashing on every debounce tick.
 * Because incremental auto-save is incompatible with all-or-nothing `required`
 * gating, forms that want every field to persist on its own must not emit HTML
 * `required` (keep the asterisk as a soft hint) — see the systems detail form.
 *
 * Conditionally-mounted forms (edit-cards, collapsible bodies) are supported:
 * the hook re-attaches its listeners and re-establishes the baseline whenever
 * `formRef.current` changes, so a form that mounts after the hook does still
 * auto-saves.
 *
 * Lossless on close/navigate: a pending debounced save is flushed (a) on
 * unmount, and (b) on demand via the returned `flush()` — call it right before
 * collapsing/closing an edit surface so the last keystroke is never dropped.
 */
function serializeForm(form: HTMLFormElement): string {
  const parts: string[] = [];
  for (const [key, value] of new FormData(form).entries()) {
    parts.push(`${key}=${typeof value === "string" ? value : `${value.name}:${value.size}`}`);
  }
  // FormData order follows the DOM, which can shift when conditional fields
  // mount/unmount — sort so only real value changes count as a change.
  parts.sort();
  return parts.join("&");
}

export function useFormAutoSave(
  formRef: RefObject<HTMLFormElement | null>,
  delay = 700,
  watch?: () => string,
): () => void {
  const lastRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // True while a debounce timer is armed; cleared when it fires or is flushed.
  // Lets unmount/flush submit a pending save exactly once (no double submit).
  const pendingRef = useRef(false);
  // The form the native listeners are currently bound to — tracked so we can
  // re-bind when a conditionally-rendered form mounts/unmounts.
  const boundFormRef = useRef<HTMLFormElement | null>(null);
  // Keep the latest `watch` without re-memoising `schedule` (callers pass fresh
  // inline closures every render).
  const watchRef = useRef(watch);
  watchRef.current = watch;

  const submitIfValid = useCallback((form: HTMLFormElement) => {
    if (typeof form.checkValidity === "function" && !form.checkValidity()) return;
    form.requestSubmit();
  }, []);

  const schedule = useCallback(() => {
    const form = formRef.current;
    // A new (or removed) form → re-bind listeners and drop the stale baseline
    // so we re-establish it against the freshly-mounted form rather than
    // comparing across instances.
    if (boundFormRef.current !== form) {
      if (boundFormRef.current) {
        boundFormRef.current.removeEventListener("input", schedule);
        boundFormRef.current.removeEventListener("change", schedule);
      }
      if (form) {
        form.addEventListener("input", schedule);
        form.addEventListener("change", schedule);
      }
      boundFormRef.current = form;
      lastRef.current = null;
    }
    if (!form) return;
    const w = watchRef.current;
    const serialized = serializeForm(form) + (w ? ` ${w()}` : "");
    if (lastRef.current === null) {
      lastRef.current = serialized; // first observation — establish baseline, don't save
      return;
    }
    if (serialized === lastRef.current) return; // nothing submittable changed
    lastRef.current = serialized;
    clearTimeout(timerRef.current);
    pendingRef.current = true;
    timerRef.current = setTimeout(() => {
      pendingRef.current = false;
      submitIfValid(form);
    }, delay);
  }, [formRef, delay, submitIfValid]);

  // Submit a pending save immediately. Call before collapsing/closing an edit
  // surface (the form may unmount before the debounce fires). Idempotent.
  const flush = useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    clearTimeout(timerRef.current);
    const form = formRef.current ?? boundFormRef.current;
    if (form) submitIfValid(form);
  }, [formRef, submitIfValid]);

  // Controlled changes (and the form mounting/unmounting) re-render → observe
  // via the live FormData and re-bind listeners. No dep array: intentionally
  // runs after every render.
  useEffect(() => {
    schedule();
  });

  // Detach listeners + flush any pending save on unmount. React runs cleanup
  // before detaching the DOM node, so the form is still submittable here — this
  // makes navigation away lossless too. The per-render effect intentionally
  // does NOT clear the timer (that would cancel the debounce on an unrelated
  // re-render such as the pending-state toggle).
  useEffect(() => {
    return () => {
      const form = boundFormRef.current;
      if (form) {
        form.removeEventListener("input", schedule);
        form.removeEventListener("change", schedule);
      }
      const pending = pendingRef.current;
      pendingRef.current = false;
      clearTimeout(timerRef.current);
      if (pending && form) submitIfValid(form);
    };
  }, [schedule, submitIfValid]);

  return flush;
}
