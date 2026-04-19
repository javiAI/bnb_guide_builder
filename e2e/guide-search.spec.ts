import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Rama 10H — E2E coverage for the public-guide client search dialog.
// Runs across every project in playwright.config.ts (375 / 768 / 1280 +
// iPhone 13). Uses the `rich` fixture because it populates the amenities
// section that the "wifi" query is expected to hit.

const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

test.describe("guide search: rich fixture", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/g/e2e/rich");
    await page.waitForSelector("main.guide-sections");
  });

  test("trigger opens the dialog with a searchbox", async ({ page }) => {
    await page
      .getByRole("button", { name: "Buscar en la guía" })
      .first()
      .click();
    await expect(
      page.getByRole("searchbox", { name: "Buscar en la guía" }),
    ).toBeVisible();
  });

  test("slash key opens the dialog, Escape closes it", async ({ page }) => {
    await page.keyboard.press("/");
    const input = page.getByRole("searchbox", { name: "Buscar en la guía" });
    await expect(input).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(input).toBeHidden();
  });

  test("Enter on a 'wifi' hit scrolls to the Wi-Fi item and sets the hash", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Buscar en la guía" })
      .first()
      .click();
    const input = page.getByRole("searchbox", { name: "Buscar en la guía" });
    await input.fill("wifi");

    // First option is selected by default; Enter navigates to it.
    const firstOption = page
      .getByRole("listbox")
      .getByRole("option")
      .first();
    await expect(firstOption).toHaveAttribute("aria-selected", "true");
    await expect(firstOption).toContainText(/wi-fi/i);

    await page.keyboard.press("Enter");
    await expect(input).toBeHidden();

    // The anchor must exist in the DOM and the URL hash should point at it.
    // `getElementById` is used rather than `page.locator(hash)` because
    // anchor ids like `item-essentials.amenities.am.wifi` contain dots,
    // which CSS selectors interpret as class tokens.
    const targetExists = await page.evaluate(() => {
      const hash = window.location.hash;
      if (!hash.startsWith("#item-")) return false;
      return Boolean(document.getElementById(hash.slice(1)));
    });
    expect(targetExists).toBe(true);
  });

  test("zero-result query shows the empty hint", async ({ page }) => {
    await page
      .getByRole("button", { name: "Buscar en la guía" })
      .first()
      .click();
    const input = page.getByRole("searchbox", { name: "Buscar en la guía" });
    await input.fill("xyzzyzzzqq");

    const hint = page.getByRole("status");
    await expect(hint).toContainText(/nada coincide/i);
  });

  test("trigger exposes a ≥44×44 tap target", async ({ page }) => {
    const trigger = page
      .getByRole("button", { name: "Buscar en la guía" })
      .first();
    const box = await trigger.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("zero serious/critical axe violations with the dialog open", async (
    { page },
    testInfo,
  ) => {
    await page
      .getByRole("button", { name: "Buscar en la guía" })
      .first()
      .click();
    const input = page.getByRole("searchbox", { name: "Buscar en la guía" });
    await input.fill("wifi");
    await expect(
      page.getByRole("listbox").getByRole("option").first(),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter((v) =>
      BLOCKING_IMPACTS.has(v.impact ?? ""),
    );

    if (blocking.length > 0) {
      const summary = blocking
        .map(
          (v) =>
            `[${v.impact}] ${v.id}: ${v.help}\n  nodes: ${v.nodes
              .map((n) => n.target.join(" "))
              .slice(0, 5)
              .join("; ")}`,
        )
        .join("\n");
      await testInfo.attach("axe-search-violations.txt", {
        body: summary,
        contentType: "text/plain",
      });
    }

    expect(
      blocking,
      "axe-core serious/critical violations in search dialog",
    ).toEqual([]);
  });
});
