import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Strong PWA spec (Rama 10I): exercises the full install + offline surface
// against a real fixture under `/g/e2e/rich`.
//
//   1) Manifest endpoint serves a valid PWA descriptor (slug-scoped).
//   2) SW endpoint serves JS with the right Service-Worker-Allowed header.
//   3) Offline shell route is reachable directly (precache target works).
//   4) Install nudge appears on visit ≥ 2 and persists `dismissedAt`.
//   5) axe-core stays at zero serious/critical with the nudge mounted.
//
// We deliberately do not exercise SW lifecycle (install → activate → fetch
// → offline-replay) here. Headless Chromium's SW network interception is
// flaky and would couple this spec to browser internals; the unit tests
// (`guide-sw-template.test.ts` + `guide-pwa-manifest.test.ts`) cover the
// generated SW source and manifest shape, while this spec verifies the
// integration end-to-end at the HTTP + DOM seams.

const FIXTURE = "rich";
const SCOPE = `/g/e2e/${FIXTURE}/`;
// Mirror NUDGE_STORAGE_PREFIX from src/components/public-guide/install-nudge.tsx;
// kept literal because e2e/ does not resolve the @/ alias.
const STORAGE_KEY = `guide-install-nudge:e2e/${FIXTURE}`;
const BLOCKING = new Set(["serious", "critical"]);

test.describe("public guide PWA: install + offline integration", () => {
  // Playwright gives each test a fresh BrowserContext by default — no need to
  // wipe localStorage manually. An init script that clears storage would also
  // run on the second navigation in the same test, defeating the visit
  // counter we're trying to exercise.

  test("manifest endpoint returns a valid PWA manifest", async ({ request }) => {
    const res = await request.get(`${SCOPE}manifest.webmanifest`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/manifest+json");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.scope).toBe(SCOPE);
    expect(body.start_url).toBe(SCOPE);
    expect(body.display).toBe("standalone");
    expect(Array.isArray(body.icons)).toBe(true);
    const icons = body.icons as Array<{ sizes: string; purpose?: string }>;
    expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  });

  test("service worker endpoint serves slug-scoped JS", async ({ request }) => {
    const res = await request.get(`${SCOPE}sw.js`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/javascript");
    expect(res.headers()["service-worker-allowed"]).toBe(SCOPE);
    const text = await res.text();
    expect(text).toContain(`SLUG = "e2e/${FIXTURE}"`);
    expect(text).toContain('addEventListener("install"');
    expect(text).toContain('addEventListener("activate"');
    expect(text).toContain('addEventListener("fetch"');
  });

  test("offline shell route is directly reachable", async ({ page }) => {
    const res = await page.goto(`${SCOPE}offline`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /sin conexión/i })).toBeVisible();
  });

  test("install nudge appears at threshold and dismissal persists", async ({ page }) => {
    // Pre-seed visits=1 so the first (and only) navigation crosses the
    // threshold (VISIT_THRESHOLD=2). Doing it in a single nav avoids relying
    // on SW-controlled re-navigations, which can flake in headless WebKit.
    await page.context().addInitScript((entry) => {
      const existing = window.localStorage.getItem(entry.key);
      if (!existing) {
        window.localStorage.setItem(
          entry.key,
          JSON.stringify({ visits: 1, cumulativeMs: 0, dismissedAt: null, installedAt: null }),
        );
      }
    }, { key: STORAGE_KEY });

    await page.goto(SCOPE);
    await expect(page.locator(".guide-root")).toBeVisible();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 6_000 });
    await expect(dialog.getByText(/guarda esta guía/i)).toBeVisible();

    await dialog.getByRole("button", { name: /ahora no/i }).click();
    await expect(dialog).toBeHidden();

    const stored = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as Record<string, unknown>;
    expect(typeof parsed.dismissedAt).toBe("number");
  });

  test("axe stays clean with the install nudge mounted", async ({ page }, testInfo) => {
    // Pre-seed visits=1 so the nudge appears on the first navigation.
    await page.context().addInitScript((entry) => {
      window.localStorage.setItem(
        entry.key,
        JSON.stringify({ visits: 1, cumulativeMs: 0, dismissedAt: null, installedAt: null }),
      );
    }, { key: STORAGE_KEY });

    await page.goto(SCOPE);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 6_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ""));
    if (blocking.length > 0) {
      const summary = blocking
        .map((v) => `[${v.impact}] ${v.id}: ${v.help}`)
        .join("\n");
      await testInfo.attach("axe-violations.txt", { body: summary, contentType: "text/plain" });
    }
    expect(blocking, "axe-core serious/critical violations on PWA nudge").toEqual([]);
  });
});
