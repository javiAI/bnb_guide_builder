import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { useRef, useState } from "react";
import { useFormAutoSave, useAutoSaveEditToggle } from "@/lib/use-form-auto-save";

const DELAY = 700;

// The hook calls `form.requestSubmit()`. We assert THAT (the action firing is the
// form's concern, tested elsewhere) — so mock requestSubmit on the prototype.
const submitSpy = vi.fn();
let originalRequestSubmit: typeof HTMLFormElement.prototype.requestSubmit | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  originalRequestSubmit = HTMLFormElement.prototype.requestSubmit;
  HTMLFormElement.prototype.requestSubmit = submitSpy;
  submitSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  if (originalRequestSubmit) {
    HTMLFormElement.prototype.requestSubmit = originalRequestSubmit;
  } else {
    // @ts-expect-error — jsdom may not define it; remove our stub.
    delete HTMLFormElement.prototype.requestSubmit;
  }
});

function Harness({ required = false }: { required?: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const [custom, setCustom] = useState("");
  useFormAutoSave(ref, DELAY);
  return (
    <form ref={ref} aria-label="f">
      {/* Uncontrolled → exercises the native input/change listener path. */}
      <input name="a" defaultValue="" required={required} aria-label="a" />
      {/* Controlled-mirrored hidden input → exercises the per-render FormData diff. */}
      <input type="hidden" name="custom" value={custom} />
      {/* Mutates state WITHOUT firing input/change — only the render path can see it. */}
      <button type="button" onClick={() => setCustom("z")}>
        bump
      </button>
    </form>
  );
}

// State that never reaches a form field — only `watch` can see it. The form has
// no inputs at all, so the FormData diff is constant; the save must come from
// the watched serialisation changing.
function WatchHarness() {
  const ref = useRef<HTMLFormElement>(null);
  const [payload, setPayload] = useState({ n: 0 });
  useFormAutoSave(ref, DELAY, () => JSON.stringify(payload));
  return (
    <form ref={ref} aria-label="f">
      <button type="button" onClick={() => setPayload({ n: 1 })}>
        bump
      </button>
    </form>
  );
}

// The form mounts AFTER the hook (conditional render) → exercises re-attach.
function ConditionalHarness() {
  const ref = useRef<HTMLFormElement>(null);
  const [show, setShow] = useState(false);
  useFormAutoSave(ref, DELAY);
  return (
    <>
      <button type="button" onClick={() => setShow(true)}>
        show
      </button>
      {show && (
        <form ref={ref} aria-label="f">
          <input name="a" defaultValue="" aria-label="a" />
        </form>
      )}
    </>
  );
}

// Exposes the returned `flush()` on a button so a test can flush before the
// debounce fires (mirrors a "Listo/Cerrar" handler).
function FlushHarness() {
  const ref = useRef<HTMLFormElement>(null);
  const flush = useFormAutoSave(ref, DELAY);
  return (
    <form ref={ref} aria-label="f">
      <input name="a" defaultValue="" aria-label="a" />
      <button type="button" onClick={flush}>
        listo
      </button>
    </form>
  );
}

// Edit-toggle card: form mounts only while editing; "listo" closes (flush).
function ToggleHarness() {
  const { editing, formRef, open, close } = useAutoSaveEditToggle(DELAY);
  return (
    <div>
      <button type="button" onClick={editing ? close : open}>
        toggle
      </button>
      {editing && (
        <form ref={formRef} aria-label="f">
          <input name="a" defaultValue="" aria-label="a" />
          <button type="button" onClick={close}>
            listo
          </button>
        </form>
      )}
    </div>
  );
}

describe("useFormAutoSave", () => {
  it("does not save on mount (establishes a baseline)", () => {
    render(<Harness />);
    act(() => vi.advanceTimersByTime(DELAY * 2));
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("saves once, debounced, after an uncontrolled field changes", () => {
    const { getByLabelText } = render(<Harness />);
    fireEvent.change(getByLabelText("a"), { target: { value: "hello" } });
    act(() => vi.advanceTimersByTime(DELAY - 50));
    expect(submitSpy).not.toHaveBeenCalled(); // still within the debounce window
    act(() => vi.advanceTimersByTime(100));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("coalesces rapid changes into a single save", () => {
    const { getByLabelText } = render(<Harness />);
    const input = getByLabelText("a");
    fireEvent.change(input, { target: { value: "h" } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(input, { target: { value: "he" } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(input, { target: { value: "hel" } });
    act(() => vi.advanceTimersByTime(DELAY));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("catches a custom control that mutates state without firing input/change", () => {
    const { getByText } = render(<Harness />);
    fireEvent.click(getByText("bump")); // setState → re-render → hidden input changes
    act(() => vi.advanceTimersByTime(DELAY));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("skips saving while the form is invalid (checkValidity gate)", () => {
    const { getByText } = render(<Harness required />);
    // 'a' is required and empty → form invalid. Mutate another field so a save
    // is scheduled; the checkValidity gate must suppress the requestSubmit.
    fireEvent.click(getByText("bump"));
    act(() => vi.advanceTimersByTime(DELAY));
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("does not loop: a re-render with unchanged values triggers no further save", () => {
    const { getByLabelText, rerender } = render(<Harness />);
    fireEvent.change(getByLabelText("a"), { target: { value: "x" } });
    act(() => vi.advanceTimersByTime(DELAY));
    expect(submitSpy).toHaveBeenCalledTimes(1);
    // A re-render with no value change (e.g. the action's pending-state toggle)
    // must not schedule another save.
    rerender(<Harness />);
    act(() => vi.advanceTimersByTime(DELAY * 2));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("saves when the watched serialisation changes (state not in any field)", () => {
    const { getByText } = render(<WatchHarness />);
    fireEvent.click(getByText("bump")); // setState → watch() returns a new string
    act(() => vi.advanceTimersByTime(DELAY));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("re-attaches to a form that mounts after the hook (conditional render)", () => {
    const { getByText, getByLabelText } = render(<ConditionalHarness />);
    fireEvent.click(getByText("show")); // form mounts now, after the hook did
    fireEvent.change(getByLabelText("a"), { target: { value: "hi" } });
    act(() => vi.advanceTimersByTime(DELAY));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("flush() submits a pending save immediately (before the debounce fires)", () => {
    const { getByLabelText, getByText } = render(<FlushHarness />);
    fireEvent.change(getByLabelText("a"), { target: { value: "x" } });
    expect(submitSpy).not.toHaveBeenCalled(); // still within the debounce window
    fireEvent.click(getByText("listo")); // flush()
    expect(submitSpy).toHaveBeenCalledTimes(1);
    // The pending timer was cleared by flush — it must not fire a second save.
    act(() => vi.advanceTimersByTime(DELAY * 2));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("flush() is a no-op when nothing is pending", () => {
    const { getByText } = render(<FlushHarness />);
    fireEvent.click(getByText("listo")); // no edits → nothing pending
    act(() => vi.advanceTimersByTime(DELAY * 2));
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("flushes a pending save on unmount (lossless on navigate/close)", () => {
    const { getByLabelText, unmount } = render(<Harness />);
    fireEvent.change(getByLabelText("a"), { target: { value: "x" } });
    // Unmount BEFORE the debounce fires — the cleanup must flush, not drop it.
    act(() => unmount());
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("does not flush on unmount when no save is pending", () => {
    const { unmount } = render(<Harness />);
    act(() => unmount());
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("useAutoSaveEditToggle: opens the form, then auto-saves an edit", () => {
    const { getByText, getByLabelText } = render(<ToggleHarness />);
    fireEvent.click(getByText("toggle")); // open → form mounts
    fireEvent.change(getByLabelText("a"), { target: { value: "x" } });
    act(() => vi.advanceTimersByTime(DELAY));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("useAutoSaveEditToggle: close() flushes the pending save and unmounts the form", () => {
    const { getByText, getByLabelText, queryByLabelText } = render(<ToggleHarness />);
    fireEvent.click(getByText("toggle")); // open
    fireEvent.change(getByLabelText("a"), { target: { value: "x" } });
    expect(submitSpy).not.toHaveBeenCalled(); // still within the debounce window
    fireEvent.click(getByText("listo")); // close() → flush then unmount
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(queryByLabelText("a")).toBeNull(); // form unmounted
    // The cleared debounce must not fire a second save after unmount.
    act(() => vi.advanceTimersByTime(DELAY * 2));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
