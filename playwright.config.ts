import { defineConfig, devices } from "@playwright/test";

// E2E harness for the public guide (Rama 10J). Gate bloqueante compartido por
// 10G/10H/10I: smoke + anti-leak + axe accessibility sobre /g/:slug.
//
// Dos modos:
//   - npm run test:e2e         → build + start (fiel a producción, canónico/CI)
//   - npm run test:e2e:dev     → next dev (iteración local)
//
// El servidor se levanta en puerto 3100 para evitar colisión con `next dev` en
// 3000 durante iteración simultánea. `E2E=1` habilita la ruta dev-only
// /g/e2e/[fixture] que inyecta GuideTrees en memoria (ver
// src/app/g/e2e/[fixture]/page.tsx).

const DEV_MODE = process.env.E2E_MODE === "dev";
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-mobile-375",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 } },
    },
    {
      name: "chromium-tablet-768",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "chromium-desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "webkit-mobile-375",
      use: { ...devices["Desktop Safari"], viewport: { width: 375, height: 667 } },
    },
  ],
  webServer: {
    command: DEV_MODE
      ? `E2E=1 next dev -p ${PORT}`
      : `next build && E2E=1 next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: DEV_MODE ? 120_000 : 240_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
