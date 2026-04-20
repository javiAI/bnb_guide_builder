import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Dedicated config for `npm run eval:assistant`. Re-includes the eval bank
// that vitest.config.ts excludes (it needs a live Postgres with pgvector).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/assistant-evals/release-gate.test.ts"],
    exclude: [...configDefaults.exclude, "**/.next/**"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
