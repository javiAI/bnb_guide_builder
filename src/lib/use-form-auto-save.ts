import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

/**
 * Generic auto-save for `<form>` section editors (Liora 16F.5, extended in
 * 16F.6). Edits persist as you make them — like the Acceso section — so there
 * is no "Guardar" button. Drop-in: give the form a ref and call this hook;
 * nothing per-field is needed.
 *
 * Works for `<form action={…}>` and `<form onSubmit={…}>` alike (it calls
 * `requestSubmit()`, which fires whichever the form uses). It's lossless across
 * control styles via two trigger sources feeding one debounced submit:
 *  - a per-render FormData diff — catches controlled state (text fields,
 *    steppers, radio-cards, map pins, hidden inputs React updates);
 *  - native `input`/`change` listeners — catch uncontrolled fields
 *    (`defaultValue`) that change the DOM without a React re-render.
 * For forms whose payload is built state→JSON with no name-bearing inputs (e.g.
 * policies' `buildPoliciesJson()` or systems' `handleSubmit`), pass `watch`: a
 * serialiser of that state. When provided it is the *authoritative* change
 * signal and replaces the FormData diff (the serialised state fully covers the
 * form), so no per-render FormData work runs; the form's existing action/onSubmit
 * still does the real save.
 * Without `watch` it reads the form's live `FormData`, so it never hand-lists
 * fields and never silently drops one. React state persists across the action's
 * revalidation, so the post-save render serialises identically and never
 * re-submits — *provided the form does not auto-reset*. Wire the form with
 * `onSubmit={autoSaveSubmit(formAction)}`, NOT `action={formAction}`: React 19
 * resets a managed `<form action={fn}>` after the action resolves, which reverts
 * a controlled `<select>`'s DOM to its first `<option>` (React leaves the stale
 * DOM in place because the `value` prop didn't change), so the next FormData
 * read differs and the save loops forever. Auto-save forms are long-lived
 * editors that must never reset — `autoSaveSubmit` dispatches the action
 * manually so React's managed reset never runs.
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

/**
 * Submit handler for an auto-saving `<form>`. Use it instead of
 * `action={formAction}` so React 19's managed-form auto-reset never runs (see
 * the `useFormAutoSave` note): it prevents the native submit and dispatches the
 * `useActionState` action manually with the form's live `FormData`. The action
 * still updates `state`/`pending` exactly as `action={fn}` would — only the
 * reset is skipped. Pass the `formAction` returned by `useActionState`.
 */
export function autoSaveSubmit(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch(new FormData(event.currentTarget));
  };
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
    // When `watch` is provided it is the authoritative change signal — these
    // forms build their payload state→JSON and have no independent name-bearing
    // inputs, so the serialised state fully covers the form and we skip the
    // per-render FormData serialise (which would otherwise run on every render,
    // including unrelated pending-state toggles). Otherwise the FormData diff is
    // the signal.
    const w = watchRef.current;
    const serialized = w ? w() : serializeForm(form);
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

/**
 * Edit-toggle card helper built on `useFormAutoSave` for cards whose `<form>`
 * mounts only while editing (contacts, knowledge). The hook re-attaches when
 * the form appears, and `close()` flushes the pending save before unmounting it
 * so the last keystroke is never dropped. Wire `formRef` to the `<form>`,
 * `open()` to the edit affordance, and `close()` to the "Listo" button (and to
 * a pencil toggle as `editing ? close() : open()`).
 */
export function useAutoSaveEditToggle(delay = 700, watch?: () => string) {
  const [editing, setEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const flush = useFormAutoSave(formRef, delay, watch);
  const open = useCallback(() => setEditing(true), []);
  const close = useCallback(() => {
    flush();
    setEditing(false);
  }, [flush]);
  return { editing, formRef, open, close };
}
