import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders the label text", () => {
    render(<Badge label="Borrador" tone="warning" />);
    expect(screen.getByText("Borrador")).toBeInTheDocument();
  });

  it("applies correct tone classes for success", () => {
    const { container } = render(<Badge label="Activa" tone="success" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("badge-success");
  });

  it("applies correct tone classes for danger (maps to error tokens)", () => {
    const { container } = render(<Badge label="Error" tone="danger" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("badge-error");
  });
});
