/**
 * True when the event target is a text-editable element (input / textarea /
 * select / contenteditable). Used by Escape / click-outside handlers that must
 * not fire while the user is typing inside a field.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
