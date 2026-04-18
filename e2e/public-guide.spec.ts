import { test, expect } from "@playwright/test";
import { E2E_FIXTURES } from "../src/test/fixtures/e2e";

// Smoke spec: each fixture renders the public-guide shell and core structure
// without server errors. Intentionally minimal — it validates "page renders"
// for every fixture × viewport so downstream specs (anti-leak + axe) run on
// a known-good DOM.

for (const fixture of E2E_FIXTURES) {
  test.describe(`public guide: ${fixture}`, () => {
    test("renders header, main and guide-root without 500", async ({ page }) => {
      const response = await page.goto(`/g/e2e/${fixture}`);
      expect(response?.status()).toBe(200);

      await expect(page.locator(".guide-root")).toBeVisible();
      await expect(page.locator("header[role='banner']")).toBeVisible();
      await expect(page.locator("main.guide-sections")).toBeVisible();
      // h1 lives inside the brand header — confirms the shell rendered with
      // a real title without freezing any specific microcopy.
      await expect(page.locator("header[role='banner'] h1")).toBeVisible();
    });

    test("renders at least one section or empty state", async ({ page }) => {
      await page.goto(`/g/e2e/${fixture}`);
      // Either a section card is visible (rich/adversarial have content, or
      // empty has a non-hidden empty section) or the page is a graceful
      // empty shell. We accept both by requiring `main` to have children.
      const mainChildCount = await page.locator("main.guide-sections > *").count();
      expect(mainChildCount).toBeGreaterThan(0);
    });
  });
}
