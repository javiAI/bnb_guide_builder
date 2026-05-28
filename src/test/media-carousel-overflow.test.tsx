import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

// `next/navigation` is mocked because <MediaCarousel> threads `useMediaUpload`
// which calls `useRouter()`. The carousel itself does not navigate — a stub
// router is enough for jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

// Media server actions are unreachable from jsdom; stub them so the upload
// hook constructs without throwing on bundle resolution.
vi.mock("@/lib/actions/media.actions", () => ({
  assignMediaAction: vi.fn(),
  confirmUploadAction: vi.fn(),
  deleteMediaAction: vi.fn(),
  requestUploadAction: vi.fn(),
}));

import { MediaCarousel, type MediaCarouselSlide } from "@/components/ui/media-carousel";

function makeSlides(n: number): MediaCarouselSlide[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `slide-${i}`,
    kind: "image" as const,
    title: `Slide ${i + 1}`,
    alt: `alt ${i + 1}`,
    url: `https://example.test/${i}.jpg`,
  }));
}

function renderCarousel(slideCount: number, opts?: { width?: number }) {
  const Wrapper = () => (
    <div style={{ width: opts?.width ?? 245 }}>
      <MediaCarousel
        slides={makeSlides(slideCount)}
        propertyId="prop_test"
        title="Edificio"
        variant="collapsed"
        uploadEntityType="access_method"
        uploadUsageKey="access.building"
      />
    </div>
  );
  return render(<Wrapper />);
}

describe("<MediaCarousel> indicator overflow", () => {
  it("renders one button per slide when count ≤ MAX_VISIBLE_DOTS (5)", () => {
    const { container } = renderCarousel(5);
    const dotStrip = container.querySelector('[data-carousel-indicator="dots"]');
    expect(dotStrip).toBeTruthy();
    const compactStrip = container.querySelector('[data-carousel-indicator="compact"]');
    expect(compactStrip).toBeNull();
    // 5 slide-picker buttons (one per slide).
    const buttons = within(dotStrip as HTMLElement).getAllByRole("button");
    expect(buttons).toHaveLength(5);
  });

  it("switches to compact mode (counter + prev/next arrows) when slides > MAX_VISIBLE_DOTS", () => {
    const { container } = renderCarousel(8);
    expect(container.querySelector('[data-carousel-indicator="dots"]')).toBeNull();
    const compact = container.querySelector('[data-carousel-indicator="compact"]');
    expect(compact).toBeTruthy();
    // Exactly two arrows — no per-slide dot row.
    const buttons = within(compact as HTMLElement).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(screen.getByLabelText("Slide anterior")).toBeTruthy();
    expect(screen.getByLabelText("Slide siguiente")).toBeTruthy();
    // Counter announces position; aria-live so SR reads updates.
    const counter = container.querySelector("[data-carousel-counter]") as HTMLElement;
    expect(counter).toBeTruthy();
    expect(counter.textContent).toMatch(/^\s*1\s*\/\s*8\s*$/);
    expect(counter.getAttribute("aria-live")).toBe("polite");
  });

  it("counter updates as user clicks next / prev (any slide reachable via click)", () => {
    const { container } = renderCarousel(8);
    const compact = container.querySelector('[data-carousel-indicator="compact"]') as HTMLElement;
    const counter = container.querySelector("[data-carousel-counter]") as HTMLElement;
    const nextBtn = within(compact).getByLabelText("Slide siguiente");
    const prevBtn = within(compact).getByLabelText("Slide anterior");
    // 1/8 → 8/8 by walking forward six times wraps via 2,3,…,8.
    fireEvent.click(nextBtn);
    expect(counter.textContent).toMatch(/2\s*\/\s*8/);
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect(counter.textContent).toMatch(/8\s*\/\s*8/);
    // Wrap-around: next from last → first.
    fireEvent.click(nextBtn);
    expect(counter.textContent).toMatch(/1\s*\/\s*8/);
    // Prev from first → last (wrap-around in the opposite direction).
    fireEvent.click(prevBtn);
    expect(counter.textContent).toMatch(/8\s*\/\s*8/);
  });

  it("Home/End keyboard jumps to first/last (keyboard reach for any slide)", () => {
    const { container } = renderCarousel(8);
    const nextBtn = screen.getByLabelText("Slide siguiente");
    const counter = container.querySelector("[data-carousel-counter]") as HTMLElement;
    // Move to slide 3, then End → 8.
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect(counter.textContent).toMatch(/3\s*\/\s*8/);
    fireEvent.keyDown(nextBtn, { key: "End" });
    expect(counter.textContent).toMatch(/8\s*\/\s*8/);
    fireEvent.keyDown(nextBtn, { key: "Home" });
    expect(counter.textContent).toMatch(/1\s*\/\s*8/);
  });

  it("compact-mode arrow buttons are real 44×44 controls (no pseudo-slop)", () => {
    renderCarousel(8);
    const prev = screen.getByLabelText("Slide anterior");
    const next = screen.getByLabelText("Slide siguiente");
    // Both arrows declare h-11 (44px) + w-11 (44px) directly. No
    // `recipe-icon-btn-32` / `recipe-dot-24` slop — verify the previously-
    // removed recipe class is NOT present (would indicate a regression).
    expect(prev.className).toMatch(/\bh-11\b/);
    expect(prev.className).toMatch(/\bw-11\b/);
    expect(next.className).toMatch(/\bh-11\b/);
    expect(next.className).toMatch(/\bw-11\b/);
    expect(prev.className).not.toMatch(/recipe-dot-24/);
    expect(next.className).not.toMatch(/recipe-dot-24/);
  });

  it("threshold is strictly > MAX_VISIBLE_DOTS (6 slides → compact, 5 slides → dots)", () => {
    const { container: c5 } = renderCarousel(5);
    expect(c5.querySelector('[data-carousel-indicator="dots"]')).toBeTruthy();
    expect(c5.querySelector('[data-carousel-indicator="compact"]')).toBeNull();
    const { container: c6 } = renderCarousel(6);
    expect(c6.querySelector('[data-carousel-indicator="dots"]')).toBeNull();
    expect(c6.querySelector('[data-carousel-indicator="compact"]')).toBeTruthy();
  });
});
