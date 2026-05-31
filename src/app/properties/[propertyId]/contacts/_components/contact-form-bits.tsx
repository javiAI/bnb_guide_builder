import { contactTypes } from "@/lib/contact-types-loader";
import type { ActionResult } from "@/lib/types/action-result";
import { FIELD } from "./styles";

// Shared form bits for the contacts create/edit forms — the contact-type
// <select> and the action-error renderer were byte-identical in both forms.

const groups = contactTypes.groups;

// Precompute items per group once from the static taxonomy — avoids
// re-filtering the full item list per <optgroup> on every form render.
const ITEMS_BY_GROUP = new Map<string, (typeof contactTypes.items)>();
for (const item of contactTypes.items) {
  const arr = ITEMS_BY_GROUP.get(item.group) ?? [];
  arr.push(item);
  ITEMS_BY_GROUP.set(item.group, arr);
}

interface ContactTypeSelectProps {
  defaultValue?: string;
  required?: boolean;
  autoFocus?: boolean;
}

/** `<select name="roleKey">` with one <optgroup> per contact-type group.
 *  Shows a placeholder option only when there is no defaultValue (create). */
export function ContactTypeSelect({ defaultValue, required, autoFocus }: ContactTypeSelectProps) {
  return (
    <select
      name="roleKey"
      defaultValue={defaultValue}
      required={required}
      autoFocus={autoFocus}
      className={FIELD}
    >
      {!defaultValue && <option value="">Seleccionar tipo</option>}
      {groups.map((g) => (
        <optgroup key={g.id} label={g.label}>
          {(ITEMS_BY_GROUP.get(g.id) ?? []).map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Renders the action's top-level error + per-field errors, if any. */
export function FormErrors({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  const { error, fieldErrors } = state;
  if (!error && !fieldErrors) return null;
  return (
    <>
      {error && <p className="text-sm text-[var(--color-status-error-text)]">{error}</p>}
      {fieldErrors &&
        Object.entries(fieldErrors).map(([field, errors]) => (
          <p key={field} className="text-sm text-[var(--color-status-error-text)]">{errors?.[0]}</p>
        ))}
    </>
  );
}
