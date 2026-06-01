import { useCallback, useEffect, useRef, type RefObject } from "react";

/**
 * Generic auto-save for `<form>` section editors (Liora 16F.5). Edits persist as
 * you make them — like the Acceso section — so there is no "Guardar" button.
 * Drop-in: give the form a ref and call this hook; nothing per-field is needed.
 *
 * Works for `<form action={…}>` and `<form onSubmit={…}>` alike (it calls
 * `requestSubmit()`, which fires whichever the form uses). It's lossless across
 * control styles by combining two triggers on the same debounced submit:
 *  - a per-render FormData diff — catches controlled state (text fields,
 *    steppers, radio-cards, map pins, hidden inputs React updates);
 *  - native `input`/`change` listeners — catch uncontrolled fields
 *    (`defaultValue`) that change the DOM without a React re-render.
 * Either way it reads the form's live `FormData`, so it never hand-lists fields
 * and never silently drops one. The form's controlled state persists across the
 * action's revalidation, so the post-save render serialises identically and
 * never re-submits (no loop).
 *
 * `requestSubmit()` runs native validation, gated by `checkValidity()` first so
 * an invalid form (e.g. an empty required field) is skipped silently until
 * valid — no browser validation bubbles.
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

export function useFormAutoSave(formRef: RefObject<HTMLFormElement | null>, delay = 700): void {
  const lastRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const schedule = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const serialized = serializeForm(form);
    if (lastRef.current === null) {
      lastRef.current = serialized; // first observation — establish baseline, don't save
      return;
    }
    if (serialized === lastRef.current) return; // nothing submittable changed
    lastRef.current = serialized;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (typeof form.checkValidity === "function" && !form.checkValidity()) return;
      form.requestSubmit();
    }, delay);
  }, [formRef, delay]);

  // Controlled changes re-render → observe via the live FormData. No dep array:
  // intentionally runs after every render.
  useEffect(() => {
    schedule();
  });

  // Uncontrolled fields (defaultValue) mutate the DOM without re-rendering —
  // catch them via native input/change events.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    return () => {
      form.removeEventListener("input", schedule);
      form.removeEventListener("change", schedule);
    };
  }, [formRef, schedule]);

  // Clear any pending debounce on unmount (the per-render effect intentionally
  // does NOT clear on every render — that would cancel the debounce on an
  // unrelated re-render such as the pending-state toggle).
  useEffect(() => () => clearTimeout(timerRef.current), []);
}
