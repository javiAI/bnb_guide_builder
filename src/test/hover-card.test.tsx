import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { HoverCard } from "@/components/ui/hover-card";

// Radix `react-use-size` calls `new ResizeObserver()` on mount; jsdom lacks it.
class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver;

/**
 * Wrapper composition test for the HoverCard primitive.
 *
 * We do NOT re-test Radix internals (focus management, escape close,
 * click-outside, ARIA — Radix has its own coverage). We DO assert:
 *   1. Trigger is rendered.
 *   2. On hover the content reaches the DOM and is rendered to a portal
 *      whose closest <button> ancestor is null (the bug from v4 was that
 *      our hand-rolled popover lived inside a parent <button>, which
 *      stripped/reordered markup and prevented the popover from showing).
 *   3. The Content carries the expected design-token classes.
 */
describe("HoverCard primitive", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the trigger", () => {
    render(
      <HoverCard
        trigger={<span data-testid="trigger">+3</span>}
        content={<span>hidden items</span>}
      />,
    );
    expect(screen.getByTestId("trigger")).toBeInTheDocument();
  });

  it("escapes a parent <button> via portal when opened", async () => {
    // Reproduce the v4 bug surface: trigger nested inside a <button>.
    render(
      <button type="button">
        <HoverCard
          trigger={<span data-testid="trigger">+3</span>}
          content={<span data-testid="popover">hidden A · hidden B</span>}
        />
      </button>,
    );

    const trigger = screen.getByTestId("trigger");
    // Radix HoverCard opens on pointerenter / focus.
    await act(async () => {
      fireEvent.pointerEnter(trigger);
      fireEvent.focus(trigger);
    });

    const popover = await screen.findByTestId("popover");
    expect(popover).toBeInTheDocument();

    // Critical invariant: the popover's nearest button ancestor must be null
    // — proving Radix portaled the content out of the parent <button>.
    expect(popover.closest("button")).toBeNull();
  });

  it("renders content with design-token shell classes", async () => {
    render(
      <HoverCard
        trigger={<span data-testid="trigger">+3</span>}
        content={<span data-testid="popover">x</span>}
      />,
    );
    const trigger = screen.getByTestId("trigger");
    await act(async () => {
      fireEvent.pointerEnter(trigger);
      fireEvent.focus(trigger);
    });
    const popover = await screen.findByTestId("popover");
    // Radix sets data-state="open|closed" on the Content element; walk up
    // from the rendered child to find that element and assert our shell
    // classes landed on it.
    const shell = popover.closest('[data-state="open"]') as HTMLElement | null;
    expect(shell).not.toBeNull();
    const cls = shell!.className;
    expect(cls).toContain("bg-[var(--color-background-elevated)]");
    expect(cls).toContain("border-[var(--color-border-default)]");
    expect(cls).toContain("shadow-[var(--elevation-surface-lg)]");
    expect(cls).toContain("max-w-[240px]");
  });
});
