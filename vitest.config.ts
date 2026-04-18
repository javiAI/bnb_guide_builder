import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Extend (not replace) the default excludes so we keep `.idea`, `.git`,
    // `.cache`, `*.config.*`, etc. Add `.next/` and the Playwright `e2e/`
    // folder — Playwright runs them under `npm run test:e2e`.
    exclude: [...configDefaults.exclude, "**/.next/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
