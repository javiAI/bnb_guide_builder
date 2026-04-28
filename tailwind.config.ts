import type { Config } from "tailwindcss";
import { warmAnalyticalTheme } from "./design-system/foundations/tokens/tailwind.tokens";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    // warmAnalyticalTheme is `as const` (readonly). Cast via unknown to satisfy
    // Tailwind's mutable Config["theme"]["extend"] shape — runtime is unchanged.
    extend: warmAnalyticalTheme as unknown as NonNullable<Config["theme"]>["extend"],
  },
  plugins: [],
};

export default config;
