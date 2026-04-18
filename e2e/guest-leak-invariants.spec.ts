import { test, expect } from "@playwright/test";
import { E2E_FIXTURES } from "../src/test/fixtures/e2e";
import { INTERNAL_FIELD_LABEL_DENYLIST } from "../src/lib/services/guide-presentation.service";
import { TAXONOMY_KEY_PATTERN } from "../src/lib/presenters/types";

// DOM-side replica of the 4 observable anti-leak invariants from
// QA_AND_RELEASE §3 (invariants 1-4). The 5th invariant
// (`presentationType: "raw"`) is not observable at the DOM level — the
// renderer collapses raw-sentinel items to `null` — so it stays covered
// unitarily by `src/test/guest-leak-invariants.test.ts`.
//
// Assertions primarily target rendered text inside <main>; a complementary
// innerHTML check catches raw JSON shapes that whitespace collapsing could
// hide from innerText.

// Host-editorial copy planted in every fixture. Any of these strings reaching
// the guest means `section.emptyCopy` leaked (invariant 3 — the renderer must
// resolve to `emptyCopyGuest` or hide the section).
const HOST_EDITORIAL_COPY = [
  "Añade políticas de ruido, fumar y mascotas.",
  "Añade contactos de emergencia para que aparezcan aquí.",
  "Añade runbooks a tus amenities.",
  "Añade instrucciones de llegada.",
  "Añade algo aquí para que aparezca en la guía.",
  "Añade políticas.",
  "Añade equipamiento.",
  "Añade espacios.",
  "Añade contactos.",
];

for (const fixture of E2E_FIXTURES) {
  test.describe(`guest leak invariants: ${fixture}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/g/e2e/${fixture}`);
      await page.waitForSelector("main.guide-sections");
    });

    test("invariant 1 — no raw JSON in visible main text", async ({ page }) => {
      const mainText = (await page.locator("main").innerText()) ?? "";
      expect(mainText).not.toContain('"json":');
      // JSON blob shape: { "key": ...
      expect(mainText, "value looks like a serialized JSON object").not.toMatch(
        /\{\s*"[a-z_]+"\s*:/i,
      );
    });

    test("invariant 1b — no raw JSON in main innerHTML (complementary)", async ({ page }) => {
      const html = await page.locator("main").innerHTML();
      expect(html).not.toContain('"json":');
    });

    test("invariant 2 — no taxonomy keys in value-bearing elements", async ({ page }) => {
      const values = await page
        .locator("main .guide-item__value, main .guide-item__field-value")
        .allInnerTexts();
      for (const v of values) {
        const trimmed = v.trim();
        expect(
          trimmed,
          `leaked taxonomy key in value: "${trimmed}"`,
        ).not.toMatch(TAXONOMY_KEY_PATTERN);
      }
    });

    test("invariant 3 — no host editorial empty copy visible to guest", async ({ page }) => {
      const mainText = (await page.locator("main").innerText()) ?? "";
      for (const copy of HOST_EDITORIAL_COPY) {
        expect(mainText, `leaked host empty copy: "${copy}"`).not.toContain(copy);
      }
    });

    test("invariant 4 — no internal field labels in field labels", async ({ page }) => {
      const fieldLabels = await page
        .locator("main .guide-item__field-label")
        .allInnerTexts();
      for (const label of fieldLabels) {
        const trimmed = label.trim();
        expect(
          INTERNAL_FIELD_LABEL_DENYLIST.has(trimmed),
          `leaked internal field label: "${trimmed}"`,
        ).toBe(false);
      }
    });
  });
}
