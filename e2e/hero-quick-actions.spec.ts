import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Rama 10G — E2E coverage for the public-guide hero + quick actions.
// Runs across all configured projects (375 / 768 / 1280 + iPhone 13), so
// viewport coverage follows playwright.config.ts. Uses the `rich` fixture
// which populates every quick-action data source (Wi-Fi password, host
// phone, street address, smart-lock access item).

const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

test.describe("hero quick actions: rich fixture", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/g/e2e/rich");
    await page.waitForSelector("main.guide-sections");
  });

  test("hero section renders as the first guide section", async ({ page }) => {
    const firstSectionId = await page
      .locator("main section.guide-section")
      .first()
      .getAttribute("id");
    expect(firstSectionId).toBe("gs.essentials");

    const hero = page.locator("#gs\\.essentials");
    await expect(hero).toHaveClass(/guide-section--hero/);
  });

  test("renders all 5 quick actions with correct hrefs and aria-labels", async ({
    page,
  }) => {
    const group = page.getByRole("group", { name: "Acciones rápidas" });
    await expect(group).toBeVisible();

    const copyBtn = group.getByRole("button", {
      name: "Copiar contraseña del Wi-Fi",
    });
    await expect(copyBtn).toBeVisible();

    const call = group.getByRole("link", { name: "Llamar al anfitrión" });
    await expect(call).toHaveAttribute("href", "tel:+34600111222");

    const wa = group.getByRole("link", {
      name: "Enviar WhatsApp al anfitrión",
    });
    await expect(wa).toHaveAttribute("href", "https://wa.me/34600111222");

    const maps = group.getByRole("link", { name: "Abrir la dirección en Maps" });
    const mapsHref = await maps.getAttribute("href");
    expect(mapsHref).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
    );
    await expect(maps).toHaveAttribute("target", "_blank");
    await expect(maps).toHaveAttribute("rel", /noopener/);

    const access = group.getByRole("link", {
      name: "Ir a las instrucciones de entrada",
    });
    await expect(access).toHaveAttribute("href", "#item-arrival.access");
  });

  test("every quick action exposes a ≥44×44 tap target", async ({ page }) => {
    const actions = page.locator(".guide-quick-actions .guide-quick-action");
    const count = await actions.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await actions.nth(i).boundingBox();
      expect(box, `action ${i} has a measurable bounding box`).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("copy Wi-Fi writes to clipboard and shows a live toast", async ({
    page,
    context,
    browserName,
  }) => {
    // Clipboard permissions are a chromium concept; webkit exposes the API
    // without prompting but rejects grantPermissions with an unknown name.
    test.skip(
      browserName !== "chromium",
      "clipboard permission API is chromium-only",
    );
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const btn = page.getByRole("button", {
      name: "Copiar contraseña del Wi-Fi",
    });
    await btn.click();

    // Radix toast renders both a visible Title and an off-screen announce
    // region with the same text; scope to the visible title to avoid a
    // strict-mode match on two nodes.
    const toast = page.locator(".guide-toast__title", {
      hasText: "Contraseña copiada",
    });
    await expect(toast).toBeVisible();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toBe("welcome2026");
  });

  test("zero serious/critical axe violations with hero present", async (
    { page },
    testInfo,
  ) => {
    // Scope axe to the hero + its descendants. Fixture-wide axe coverage
    // lives in axe-a11y.spec.ts; this assertion ensures the hero shipped
    // in 10G does not regress the gate on its own subtree.
    const results = await new AxeBuilder({ page })
      .include("#gs\\.essentials")
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
      await testInfo.attach("axe-hero-violations.txt", {
        body: summary,
        contentType: "text/plain",
      });
    }

    expect(blocking, "axe-core serious/critical violations in hero").toEqual(
      [],
    );
  });
});
