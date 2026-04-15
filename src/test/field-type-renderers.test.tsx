import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  renderFieldInput,
  fieldTypeWrapsOwnLabel,
  FIELD_RENDERER_KEYS,
} from "@/config/registries/field-type-renderers";
import type { FieldTypeMeta } from "@/config/registries/field-type-registry";

function mk(overrides: Partial<FieldTypeMeta> & { type: FieldTypeMeta["type"] }): FieldTypeMeta {
  return { id: "f1", label: "Mi campo", ...overrides };
}

describe("field-type-renderers — renderInput", () => {
  it("boolean renders a checkbox with an inline label", () => {
    const { container } = render(
      <>{renderFieldInput({ field: mk({ type: "boolean" }), value: false, onChange: () => {} })}</>,
    );
    expect(container.querySelector("input[type=checkbox]")).not.toBeNull();
    expect(screen.getByText("Mi campo")).toBeInTheDocument();
  });

  it("text onChange emits the typed value", () => {
    let captured: unknown = undefined;
    const { container } = render(
      <>{renderFieldInput({
        field: mk({ type: "text" }),
        value: "",
        onChange: (v) => {
          captured = v;
        },
      })}</>,
    );
    const input = container.querySelector("input[type=text]") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hola" } });
    expect(captured).toBe("hola");
  });

  it("text onChange emits null when the input is cleared", () => {
    let captured: unknown = "seed";
    const { container } = render(
      <>{renderFieldInput({
        field: mk({ type: "text" }),
        value: "seed",
        onChange: (v) => {
          captured = v;
        },
      })}</>,
    );
    const input = container.querySelector("input[type=text]") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(captured).toBeNull();
  });

  it("enum renders a select with every option", () => {
    const { container } = render(
      <>{renderFieldInput({
        field: mk({
          type: "enum",
          options: [
            { id: "a", label: "Alfa", description: "" },
            { id: "b", label: "Beta", description: "" },
          ],
        }),
        value: null,
        onChange: () => {},
      })}</>,
    );
    const opts = container.querySelectorAll("option");
    // placeholder "—" + 2 options
    expect(opts.length).toBe(3);
    expect(screen.getByText("Alfa")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("password hides the value (type=password)", () => {
    const { container } = render(
      <>{renderFieldInput({ field: mk({ type: "password" }), value: "secret", onChange: () => {} })}</>,
    );
    expect(container.querySelector("input[type=password]")).not.toBeNull();
  });

  it("textarea renders a textarea with rows=3", () => {
    const { container } = render(
      <>{renderFieldInput({ field: mk({ type: "textarea" }), value: "", onChange: () => {} })}</>,
    );
    const ta = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(ta).not.toBeNull();
    expect(ta.rows).toBe(3);
  });

  it("number onChange emits a Number when typed", () => {
    let captured: unknown = undefined;
    const { container } = render(
      <>{renderFieldInput({
        field: mk({ type: "number" }),
        value: "",
        onChange: (v) => {
          captured = v;
        },
      })}</>,
    );
    const input = container.querySelector("input[type=number]") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "42" } });
    expect(captured).toBe(42);
  });

  it("number onChange emits null when cleared from a seeded value", () => {
    let captured: unknown = 42;
    const { container } = render(
      <>{renderFieldInput({
        field: mk({ type: "number" }),
        value: 42,
        onChange: (v) => {
          captured = v;
        },
      })}</>,
    );
    const input = container.querySelector("input[type=number]") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(captured).toBeNull();
  });

  it("throws for unknown types (same loud error as the validator)", () => {
    expect(() =>
      renderFieldInput({
        field: mk({ type: "bogus" as FieldTypeMeta["type"] }),
        value: null,
        onChange: () => {},
      }),
    ).toThrow(/Unknown field type "bogus"/);
  });
});

describe("field-type-renderers — time_range_optional", () => {
  it("preserves the first entered side when the other is still empty (no premature null emit)", () => {
    const captured: unknown[] = [];
    const { container } = render(
      <>{renderFieldInput({
        field: mk({ type: "time_range_optional" }),
        value: null,
        onChange: (v) => {
          captured.push(v);
        },
      })}</>,
    );
    const [fromInput, toInput] = container.querySelectorAll("input[type=time]") as NodeListOf<HTMLInputElement>;

    fireEvent.change(fromInput, { target: { value: "09:00" } });
    // With only the "from" side filled, the component must NOT emit
    // (neither null, which would wipe the just-entered pick on re-render,
    // nor a half-complete string). The local state keeps the value visible.
    expect(captured).toEqual([]);
    expect(fromInput.value).toBe("09:00");

    fireEvent.change(toInput, { target: { value: "11:30" } });
    // Both sides now set → a single combined emission.
    expect(captured).toEqual(["09:00-11:30"]);
  });

  it("emits null when both sides are cleared from a seeded value", () => {
    const captured: unknown[] = [];
    const { container } = render(
      <>{renderFieldInput({
        field: mk({ type: "time_range_optional" }),
        value: "09:00-11:30",
        onChange: (v) => {
          captured.push(v);
        },
      })}</>,
    );
    const [fromInput, toInput] = container.querySelectorAll("input[type=time]") as NodeListOf<HTMLInputElement>;

    fireEvent.change(fromInput, { target: { value: "" } });
    // One side still has "11:30" → partial, no emit.
    expect(captured).toEqual([]);
    fireEvent.change(toInput, { target: { value: "" } });
    // Now fully cleared → null.
    expect(captured).toEqual([null]);
  });
});

describe("field-type-renderers — wrapsOwnLabel", () => {
  it("boolean wraps its own label; other types do not", () => {
    expect(fieldTypeWrapsOwnLabel("boolean")).toBe(true);
    for (const t of FIELD_RENDERER_KEYS) {
      if (t === "boolean") continue;
      expect(fieldTypeWrapsOwnLabel(t)).toBe(false);
    }
  });

  it("returns false for unknown types without throwing", () => {
    expect(fieldTypeWrapsOwnLabel("bogus")).toBe(false);
  });
});
