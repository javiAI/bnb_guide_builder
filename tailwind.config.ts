import type { Config } from "tailwindcss";
import { warmAnalyticalTheme } from "./design-system/foundations/tokens/tailwind.tokens";

// warmAnalyticalTheme is exported `as const` (readonly). Tailwind's Config type
// expects mutable values. Strip readonly recursively — runtime is unchanged.
type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: warmAnalyticalTheme as DeepWriteable<typeof warmAnalyticalTheme>,
  },
  plugins: [],
};

export default config;
