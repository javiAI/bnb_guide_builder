// `{{` trigger must replace the typed braces, not nest inside them.
//
// Scenario: user types `{{` → picker opens → user picks `guest_name` →
// textarea must read `{{guest_name}}`, not `{{{{guest_name}}}}`.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MessageBodyEditor } from "@/app/properties/[propertyId]/messaging/[touchpointKey]/message-body-editor";

vi.mock("@/lib/actions/messaging.actions", () => ({
  previewMessageTemplateAction: vi.fn(() => new Promise(() => {})),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

function typeInto(textarea: HTMLTextAreaElement, next: string) {
  fireEvent.change(textarea, { target: { value: next } });
  // jsdom keeps caret at 0 after `change`; simulate the caret sitting at
  // the end of the new value, matching real user input.
  textarea.selectionStart = next.length;
  textarea.selectionEnd = next.length;
}

describe("MessageBodyEditor — `{{` trigger replaces braces", () => {
  it("inserting after typing `{{` yields `{{var}}`, not `{{{{var}}}}`", () => {
    render(
      <MessageBodyEditor propertyId="p1" name="bodyMd" defaultValue="Hola " />,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Hola ");

    // Fire a change event that adds `{{` at the end, with the caret right
    // after the second brace — same shape as real typing.
    act(() => {
      typeInto(textarea, "Hola {{");
    });

    // Picker should now be open.
    expect(screen.getByRole("combobox")).toBeTruthy();

    // Click the `guest_name` option directly (first row for that variable).
    const option = screen.getByRole("option", { name: /guest_name/ });
    act(() => {
      fireEvent.click(option);
    });

    // The two `{` just typed are replaced by the full token — NOT nested.
    expect(textarea.value).toBe("Hola {{guest_name}}");
    expect(textarea.value).not.toContain("{{{{");
  });

  it("opening via the button inserts at caret (no trigger range to replace)", () => {
    render(
      <MessageBodyEditor propertyId="p1" name="bodyMd" defaultValue="Hola " />,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Insertar variable/ }));
    });

    const option = screen.getByRole("option", { name: /guest_name/ });
    act(() => {
      fireEvent.click(option);
    });

    expect(textarea.value).toBe("Hola {{guest_name}}");
  });
});
