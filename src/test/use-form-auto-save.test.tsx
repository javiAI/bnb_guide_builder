import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { useRef, useState } from "react";
import { useFormAutoSave } from "@/lib/use-form-auto-save";

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
});
