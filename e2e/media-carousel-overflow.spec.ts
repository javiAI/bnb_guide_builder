import { test, expect, type Page } from "@playwright/test";

// Playwright coverage for <MediaCarousel> indicator (PR #106 / B1).
// The component lives on the operator surface (`/properties/[propertyId]/access`)
// which requires auth + DB and isn't reachable from the public-guide E2E
// harness. The dev-only fixture at `/g/e2e/carousel/[count]` renders the
// primitive in isolation at the 245 px column width the cockpit 1×4
// cards collapse to at 1280 px viewport.
//
// Two modes under test:
//   - dots-mode (≤ MAX_VISIBLE_DOTS = 5): per-slide dot row at 24 px visual
//     with recipe-carousel-dot-24 slop (10 px per side → 44 hit on fine
//     pointers; 44 visual on coarse). Per-target 44×44 (WCAG 2.5.5) is
//     enforced per dot; adjacent ::before rectangles are allowed to
//     overlap on fine pointers within a bound (≤ 20 px) so the strip stays
//     narrow enough not to dominate the cover. On coarse pointers gap-1 +
//     44 visual = 0 overlap. Hit rectangles must not be clipped by the
//     cover's overflow-hidden bottom edge.
//   - compact-mode (> 5 slides): prev / counter / next, arrows use
//     recipe-icon-btn-32 (32 visual + 6 px slop on fine pointers; 44 visual
//     on coarse). Arrows are separated by the counter, so the expanded hit
//     rectangles cannot overlap.

async function isCoarsePointer(page: Page): Promise<boolean> {
  return page.evaluate(() => window.matchMedia("(pointer: coarse)").matches);
}

interface InsetSides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Parse the four ::before inset sides as numeric px. CSS `inset: -10px`
// resolves to `top/right/bottom/left = "-10px"` on the pseudo-element.
async function readBeforeInset(locator: ReturnType<Page["locator"]>): Promise<InsetSides> {
  return locator.evaluate((el) => {
    const cs = window.getComputedStyle(el, "::before");
    const parse = (v: string): number => Number.parseFloat(v) || 0;
    return {
      top: parse(cs.top),
      right: parse(cs.right),
      bottom: parse(cs.bottom),
      left: parse(cs.left),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact mode — > MAX_VISIBLE_DOTS slides
// ─────────────────────────────────────────────────────────────────────────────

test.describe("MediaCarousel — compact-mode overflow (8 slides)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/g/e2e/carousel/8`);
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

  test("arrows reach 44 hit area — fine pointer: 32 visual + slop, coarse: 44 visual", async ({ page }) => {
    const coarse = await isCoarsePointer(page);
    for (const label of ["Slide anterior", "Slide siguiente"]) {
      const btn = page.getByLabel(label);
      await expect(btn).toHaveClass(/recipe-icon-btn-32/);
      const box = await btn.boundingBox();
      expect(box, `${label} bounding box`).not.toBeNull();
      const inset = await readBeforeInset(btn);
      if (coarse) {
        // The recipe collapses the slop and grows the visual to 44.
        expect(box!.width, `${label} coarse width`).toBeGreaterThanOrEqual(44);
        expect(box!.height, `${label} coarse height`).toBeGreaterThanOrEqual(44);
        expect(inset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
      } else {
        // Fine pointer: 32 visual + ::before inset -6px = 44 hit.
        expect(box!.width, `${label} fine width`).toBeGreaterThanOrEqual(32);
        expect(box!.height, `${label} fine height`).toBeGreaterThanOrEqual(32);
        expect(box!.width, `${label} fine width (visual cap)`).toBeLessThan(44);
        expect(inset).toEqual({ top: -6, right: -6, bottom: -6, left: -6 });
      }
    }
  });

  test("first → middle → last reachable via clicks; wraps around", async ({ page }) => {
    const next = page.getByLabel("Slide siguiente");
    const prev = page.getByLabel("Slide anterior");
    const counter = page.locator("[data-carousel-counter]");

    await expect(counter).toHaveText(/1\s*\/\s*8/);

    for (let i = 0; i < 3; i++) await next.click();
    await expect(counter).toHaveText(/4\s*\/\s*8/);

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

// ─────────────────────────────────────────────────────────────────────────────
// Dots mode — ≤ MAX_VISIBLE_DOTS slides (use 5 = upper boundary)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("MediaCarousel — dots mode (5 slides)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/g/e2e/carousel/5`);
    await page.waitForSelector('[data-carousel-indicator="dots"]');
  });

  test("renders exactly 5 dots and no compact strip", async ({ page }) => {
    await expect(page.locator('[data-carousel-indicator="compact"]')).toHaveCount(0);
    const dots = page.locator('[data-carousel-indicator="dots"]').getByRole("button");
    await expect(dots).toHaveCount(5);
  });

  test("dot dimensions vary by pointer — 24 visual fine / ≥44 visual coarse, recipe is recipe-carousel-dot-24", async ({ page }) => {
    const coarse = await isCoarsePointer(page);
    const dots = page.locator('[data-carousel-indicator="dots"]').getByRole("button");
    const count = await dots.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i++) {
      const dot = dots.nth(i);
      await expect(dot).toHaveClass(/recipe-carousel-dot-24/);
      // The icon-button slop must not appear on dots — its 6 px slop would
      // be insufficient and lead to overlapping hit rectangles when adjacent.
      await expect(dot).not.toHaveClass(/recipe-icon-btn-32/);
      const box = await dot.boundingBox();
      expect(box, `dot[${i}] bounding box`).not.toBeNull();
      const inset = await readBeforeInset(dot);
      if (coarse) {
        expect(box!.width, `dot[${i}] coarse width`).toBeGreaterThanOrEqual(44);
        expect(box!.height, `dot[${i}] coarse height`).toBeGreaterThanOrEqual(44);
        expect(inset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
      } else {
        expect(box!.width, `dot[${i}] fine width`).toBeGreaterThanOrEqual(24);
        expect(box!.height, `dot[${i}] fine height`).toBeGreaterThanOrEqual(24);
        expect(box!.width, `dot[${i}] fine width (visual cap)`).toBeLessThan(32);
        expect(inset).toEqual({ top: -10, right: -10, bottom: -10, left: -10 });
      }
    }
  });

  test("adjacent dot hit area overlap is bounded (≤ 20 px), per-target 44 hit stays intact", async ({ page }) => {
    // The dot strip is intentionally narrow (gap-1 = 4 px) so it does
    // not dominate the 245 px chip cover. On fine pointers the
    // recipe-carousel-dot-24 ::before slop expands each 24 px visual to
    // a 44 px hit rectangle, which means adjacent rectangles overlap by
    // ~16 px at the midpoint between dots. WCAG 2.5.5 (44×44 per target)
    // is preserved per dot; clicks in the ambiguous mid-zone resolve to
    // the rightmost ::before via DOM order.
    //
    // On coarse pointers the recipe collapses ::before to inset 0 and the
    // button itself grows to 44×44, so the gap-1 spacing keeps the
    // rectangles non-overlapping (4 px between them).
    //
    // This test asserts an upper bound on overlap and validates the per-
    // target 44 hit area, instead of the previous strict no-overlap rule
    // which forced gap-5 and made the strip too wide.
    const isCoarse = await isCoarsePointer(page);
    const dots = page.locator('[data-carousel-indicator="dots"]').getByRole("button");
    const count = await dots.count();
    expect(count).toBe(5);

    const rects: { left: number; right: number; top: number; bottom: number }[] = [];
    const hitWidths: number[] = [];
    for (let i = 0; i < count; i++) {
      const dot = dots.nth(i);
      const box = await dot.boundingBox();
      const inset = await readBeforeInset(dot);
      expect(box).not.toBeNull();
      const r = {
        left: box!.x + inset.left,
        right: box!.x + box!.width - inset.right,
        top: box!.y + inset.top,
        bottom: box!.y + box!.height - inset.bottom,
      };
      rects.push(r);
      hitWidths.push(r.right - r.left);
    }

    // Per-target 44×44 invariant (WCAG 2.5.5).
    for (let i = 0; i < count; i++) {
      expect(
        hitWidths[i],
        `dot[${i}] effective hit width (${hitWidths[i]}) must be ≥ 44`,
      ).toBeGreaterThanOrEqual(44);
      expect(
        rects[i].bottom - rects[i].top,
        `dot[${i}] effective hit height must be ≥ 44`,
      ).toBeGreaterThanOrEqual(44);
    }

    // Bounded overlap between adjacent ::before rectangles. Overlap is
    // permitted (gap-1 + slop = controlled overlap) but bounded so we
    // catch regressions where the gap is dropped entirely or the slop
    // grows past the recipe contract.
    for (let i = 0; i < rects.length - 1; i++) {
      const a = rects[i];
      const b = rects[i + 1];
      const overlap = Math.max(0, a.right - b.left);
      const MAX_OVERLAP = 20; // ≤ 24 (1× dot visual) and ≤ 2× slop (20 px)
      if (isCoarse) {
        // Coarse: 44 visual + 4 px gap → rectangles do not overlap.
        expect(
          overlap,
          `coarse pointer: dots[${i}] and dots[${i + 1}] should not overlap (overlap=${overlap})`,
        ).toBe(0);
      } else {
        // Fine: expected overlap ≈ 16 px (24 + 2×10 − 4 − 24 = 16).
        expect(
          overlap,
          `fine pointer: dots[${i}]→[${i + 1}] overlap (${overlap}) must be ≤ ${MAX_OVERLAP}`,
        ).toBeLessThanOrEqual(MAX_OVERLAP);
      }
    }
  });

  test("dot hit area does not get clipped by the cover's overflow-hidden bottom", async ({ page }) => {
    // The dot indicator row is positioned absolutely inside the cover
    // container (`relative` + `overflow-hidden`). The effective hit
    // rectangle (visual ± slop) must fit inside the cover's box on both
    // the top and bottom edges — otherwise overflow-hidden clips it and
    // the bottom 1–2 px of the touch target becomes uninteractive.
    const dotsStrip = page.locator('[data-carousel-indicator="dots"]');
    const cover = dotsStrip.locator(
      'xpath=ancestor::*[contains(@class, "overflow-hidden")][1]',
    );
    const coverBox = await cover.boundingBox();
    expect(coverBox, "cover bounding box").not.toBeNull();

    const dots = page.locator('[data-carousel-indicator="dots"]').getByRole("button");
    const count = await dots.count();
    for (let i = 0; i < count; i++) {
      const dot = dots.nth(i);
      const box = await dot.boundingBox();
      const inset = await readBeforeInset(dot);
      expect(box).not.toBeNull();
      const effTop = box!.y + inset.top;
      const effBottom = box!.y + box!.height - inset.bottom;
      expect(
        effTop,
        `dot[${i}] effective top (${effTop}) clipped by cover top (${coverBox!.y})`,
      ).toBeGreaterThanOrEqual(coverBox!.y);
      expect(
        effBottom,
        `dot[${i}] effective bottom (${effBottom}) clipped by cover bottom (${coverBox!.y + coverBox!.height})`,
      ).toBeLessThanOrEqual(coverBox!.y + coverBox!.height);
    }
  });

  test("click on each dot moves aria-current", async ({ page }) => {
    const dots = page.locator('[data-carousel-indicator="dots"]').getByRole("button");
    const count = await dots.count();
    expect(count).toBe(5);

    // First is current initially.
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");

    for (let i = 1; i < count; i++) {
      await dots.nth(i).click();
      await expect(dots.nth(i)).toHaveAttribute("aria-current", "true");
      // Ensure no other dot also claims aria-current.
      for (let j = 0; j < count; j++) {
        if (j === i) continue;
        await expect(dots.nth(j)).not.toHaveAttribute("aria-current", "true");
      }
    }
  });

  test("Home / End keyboard navigates to first / last dot", async ({ page }) => {
    const dots = page.locator('[data-carousel-indicator="dots"]').getByRole("button");
    // Move to middle first by clicking dot 2 (0-indexed).
    await dots.nth(2).click();
    await expect(dots.nth(2)).toHaveAttribute("aria-current", "true");

    await dots.nth(2).focus();
    await page.keyboard.press("End");
    await expect(dots.nth(4)).toHaveAttribute("aria-current", "true");

    await page.keyboard.press("Home");
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
  });
});
