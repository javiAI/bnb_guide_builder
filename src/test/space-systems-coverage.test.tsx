import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Spy the coverage action; the component fires it inside a transition.
const updateSystemCoverageAction = vi.fn(async (..._args: unknown[]) => ({ success: true }));
vi.mock("@/lib/actions/editor.actions", () => ({
  updateSystemCoverageAction: (...a: unknown[]) => updateSystemCoverageAction(...a),
}));

import {
  SpaceSystemsCoverage,
  type SpaceCoverageSystem,
} from "@/app/properties/[propertyId]/spaces/space-systems-coverage";

const SYSTEMS: SpaceCoverageSystem[] = [
  { systemId: "sys_h", systemKey: "sys.heating", label: "Calefacción", covered: true, note: "Radiador", defaultsOn: true },
  { systemId: "sys_c", systemKey: "sys.cooling", label: "Refrigeración / AC", covered: false, note: "", defaultsOn: false },
  // Override-on against a default-off system: toggling it off returns to default.
  { systemId: "sys_v", systemKey: "sys.ventilation", label: "Ventilación", covered: true, note: "", defaultsOn: false },
];

function lastFormData(): Record<string, string> {
  const fd = updateSystemCoverageAction.mock.calls.at(-1)?.[1] as unknown as FormData;
  return Object.fromEntries(fd.entries()) as Record<string, string>;
}

describe("SpaceSystemsCoverage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders one switch per system with the right covered state", () => {
    render(<SpaceSystemsCoverage propertyId="p1" spaceId="s1" systems={SYSTEMS} />);
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(3);
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
    expect(switches[1]).toHaveAttribute("aria-checked", "false");
    expect(switches[2]).toHaveAttribute("aria-checked", "true");
  });

  it("shows a uniform note input on every system (enabled when covered, disabled otherwise)", () => {
    render(<SpaceSystemsCoverage propertyId="p1" spaceId="s1" systems={SYSTEMS} />);
    // Covered systems (heating, ventilation) get an editable note field…
    const notes = screen.getAllByPlaceholderText("Matiz para esta estancia (opcional)");
    expect(notes).toHaveLength(2);
    expect(notes[0]).toHaveValue("Radiador");
    expect(notes[0]).not.toBeDisabled();
    // …the uncovered one keeps the same-size input but disabled, so all cards
    // are the same height.
    const disabled = screen.getAllByPlaceholderText("Actívalo para añadir un matiz");
    expect(disabled).toHaveLength(1);
    expect(disabled[0]).toBeDisabled();
  });

  it("toggling an uncovered system persists override_yes for that system+space", () => {
    render(<SpaceSystemsCoverage propertyId="p1" spaceId="s1" systems={SYSTEMS} />);
    fireEvent.click(screen.getAllByRole("switch")[1]); // Refrigeración → on
    expect(updateSystemCoverageAction).toHaveBeenCalledTimes(1);
    expect(lastFormData()).toMatchObject({ systemId: "sys_c", spaceId: "s1", mode: "override_yes" });
  });

  it("toggling a covered system off persists override_no", () => {
    render(<SpaceSystemsCoverage propertyId="p1" spaceId="s1" systems={SYSTEMS} />);
    fireEvent.click(screen.getAllByRole("switch")[0]); // Calefacción (default-on) → off
    expect(lastFormData()).toMatchObject({ systemId: "sys_h", spaceId: "s1", mode: "override_no" });
  });

  it("toggling back to the taxonomy default persists inherited (clears the override)", () => {
    render(<SpaceSystemsCoverage propertyId="p1" spaceId="s1" systems={SYSTEMS} />);
    fireEvent.click(screen.getAllByRole("switch")[2]); // Ventilación: override-on, default-off → off === default
    expect(lastFormData()).toMatchObject({ systemId: "sys_v", spaceId: "s1", mode: "inherited" });
  });

  it("renders an empty-state link to Sistemas when there are no coverable systems", () => {
    render(<SpaceSystemsCoverage propertyId="p1" spaceId="s1" systems={[]} />);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Sistemas" })).toHaveAttribute("href", "/properties/p1/systems");
  });
});
