import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { E2E_FIXTURES } from "../src/test/fixtures/e2e";

// Accessibility gate (Rama 10J): axe-core must report 0 violations at
// `serious` or `critical` severity on every fixture × viewport combination.
// Lower severities (minor, moderate) are recorded in the HTML report for
// awareness but do not block the build — per decision in Fase -1.

const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

for (const fixture of E2E_FIXTURES) {
  test.describe(`axe a11y: ${fixture}`, () => {
    test("zero serious/critical violations", async ({ page }, testInfo) => {
      await page.goto(`/g/e2e/${fixture}`);
      await page.waitForSelector("main.guide-sections");

      const results = await new AxeBuilder({ page })
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
        await testInfo.attach("axe-violations.txt", {
          body: summary,
          contentType: "text/plain",
        });
      }

      expect(blocking, "axe-core serious/critical violations").toEqual([]);
    });
  });
}
