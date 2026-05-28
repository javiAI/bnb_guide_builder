import { test, expect } from "@playwright/test";

// Playwright coverage for <MediaCarousel> compact-mode overflow (PR #106 / B1).
// The component lives on the operator surface (`/properties/[propertyId]/access`)
// which requires auth + DB and isn't reachable from the public-guide E2E
// harness. The dev-only fixture at `/g/e2e/carousel/[count]` renders the
// primitive in isolation at the same 245 px column width the cockpit 1×4
// cards collapse to at 1280 px viewport.

const N_SLIDES = 8;

test.describe("MediaCarousel — compact-mode overflow", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/g/e2e/carousel/${N_SLIDES}`);
    await page.waitForSelector('[data-carousel-indicator="compact"]');
  });

  test("renders compact strip (no per-slide dot row) at 8 slides / 245 px", async ({ page }) => {
    await expect(page.locator('[data-carousel-indicator="dots"]')).toHaveCount(0);
    const compact = page.locator('[data-carousel-indicator="compact"]');
    await expect(compact).toBeVisible();

    const counter = page.locator("[data-carousel-counter]");
    await expect(counter).toHaveText(/^\s*1\s*\/\s*8\s*$/);
    await expect(counter).toHaveAttribute("aria-live", "polite");

    // Exactly two controls — prev + next.
    await expect(compact.getByRole("button")).toHaveCount(2);
    await expect(compact.getByLabel("Slide anterior")).toBeVisible();
    await expect(compact.getByLabel("Slide siguiente")).toBeVisible();
  });

  test("arrow buttons reach 44 hit area (32 visual + slop on fine pointers)", async ({ page }) => {
    // Slop pattern: button visual is 32×32 on fine pointers (h-8 w-8) and the
    // recipe-icon-btn-32 ::before extends -6px on each side, yielding a 44×44
    // hit rectangle. Assert: (a) the recipe class is present so slop applies,
    // (b) visual size ≥32, (c) the ::before pseudo extends inset -6px (the
    // documented slop). On coarse-pointer projects the recipe collapses to
    // visual 44 — covered by the webkit-iphone-13 project run.
    for (const label of ["Slide anterior", "Slide siguiente"]) {
      const btn = page.getByLabel(label);
      await expect(btn).toHaveClass(/recipe-icon-btn-32/);
      const box = await btn.boundingBox();
      expect(box, `${label} bounding box`).not.toBeNull();
      expect(box!.width, `${label} visual width`).toBeGreaterThanOrEqual(32);
      expect(box!.height, `${label} visual height`).toBeGreaterThanOrEqual(32);
      const slopInset = await btn.evaluate((el) => {
        const cs = window.getComputedStyle(el, "::before");
        return { top: cs.top, right: cs.right, bottom: cs.bottom, left: cs.left };
      });
      // -6px on each side → 32 + 6 + 6 = 44 hit area.
      expect(slopInset.top).toBe("-6px");
      expect(slopInset.right).toBe("-6px");
      expect(slopInset.bottom).toBe("-6px");
      expect(slopInset.left).toBe("-6px");
    }
  });

  test("first → middle → last reachable via clicks; wraps around", async ({ page }) => {
    const next = page.getByLabel("Slide siguiente");
    const prev = page.getByLabel("Slide anterior");
    const counter = page.locator("[data-carousel-counter]");

    // First slide (current).
    await expect(counter).toHaveText(/1\s*\/\s*8/);

    // Walk to middle (slide 4).
    for (let i = 0; i < 3; i++) await next.click();
    await expect(counter).toHaveText(/4\s*\/\s*8/);

    // Walk to last (slide 8).
    for (let i = 0; i < 4; i++) await next.click();
    await expect(counter).toHaveText(/8\s*\/\s*8/);

    // Forward wrap → first.
    await next.click();
    await expect(counter).toHaveText(/1\s*\/\s*8/);

    // Backward wrap → last.
    await prev.click();
    await expect(counter).toHaveText(/8\s*\/\s*8/);
  });

  test("Home / End keyboard reach jumps to first / last", async ({ page }) => {
    const next = page.getByLabel("Slide siguiente");
    const counter = page.locator("[data-carousel-counter]");

    await next.click();
    await next.click();
    await expect(counter).toHaveText(/3\s*\/\s*8/);

    await next.focus();
    await page.keyboard.press("End");
    await expect(counter).toHaveText(/8\s*\/\s*8/);

    await page.keyboard.press("Home");
    await expect(counter).toHaveText(/1\s*\/\s*8/);
  });
});
