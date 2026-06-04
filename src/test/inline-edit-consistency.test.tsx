import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { InlineEditText } from "@/components/ui/inline-edit-text";

afterEach(cleanup);

describe("InlineEditText — the single inline-edit system", () => {
  it("uses the SquarePen affordance (one icon everywhere)", () => {
    const { container } = render(<InlineEditText value="Casa" onCommit={() => {}} />);
    expect(container.querySelector(".lucide-square-pen")).toBeTruthy();
  });

  it("opens on the pencil and commits the trimmed value on Enter", () => {
    const onCommit = vi.fn();
    const { getByLabelText } = render(
      <InlineEditText value="Casa" onCommit={onCommit} ariaLabel="Nombre" />,
    );
    fireEvent.click(getByLabelText("Editar nombre"));
    const input = getByLabelText("Nombre") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  Villa  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Villa");
  });

  it("commits on blur and cancels on Escape (no commit)", () => {
    const onCommit = vi.fn();
    const { getByLabelText } = render(
      <InlineEditText value="Casa" onCommit={onCommit} ariaLabel="Nombre" />,
    );
    // Escape cancels — onCommit not called.
    fireEvent.click(getByLabelText("Editar nombre"));
    fireEvent.change(getByLabelText("Nombre"), { target: { value: "Otra" } });
    fireEvent.keyDown(getByLabelText("Nombre"), { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();

    // Blur commits.
    fireEvent.click(getByLabelText("Editar nombre"));
    fireEvent.change(getByLabelText("Nombre"), { target: { value: "Loft" } });
    fireEvent.blur(getByLabelText("Nombre"));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Loft");
  });

  it("does not commit when the value is unchanged", () => {
    const onCommit = vi.fn();
    const { getByLabelText } = render(
      <InlineEditText value="Casa" onCommit={onCommit} ariaLabel="Nombre" />,
    );
    fireEvent.click(getByLabelText("Editar nombre"));
    fireEvent.blur(getByLabelText("Nombre"));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("known inline-edit surfaces use the shared component (no ad-hoc forks)", () => {
    const consumers = [
      "src/app/properties/[propertyId]/property/property-form.tsx",
      "src/app/properties/[propertyId]/access/_components/place-list-row.tsx",
    ];
    for (const file of consumers) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must edit names via InlineEditText`).toContain("InlineEditText");
    }
  });
});
