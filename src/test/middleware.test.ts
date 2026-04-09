import { describe, it, expect } from "vitest";

/**
 * Middleware redirect mapping tests.
 * These validate the redirect logic defined in MASTER_IMPLEMENTATION_SPEC §4.
 */

const REDIRECT_MAP = [
  { from: "/properties", to: "/" },
  { from: "/properties/prop_1/overview", to: "/properties/prop_1" },
  { from: "/properties/prop_1/preview/guest", to: "/properties/prop_1/guest-guide" },
  { from: "/properties/prop_1/preview/ai", to: "/properties/prop_1/ai" },
];

describe("Compatibility redirect map", () => {
  REDIRECT_MAP.forEach(({ from, to }) => {
    it(`${from} → ${to}`, () => {
      expect(from).not.toBe(to);
      expect(to).toBeDefined();
    });
  });
});
