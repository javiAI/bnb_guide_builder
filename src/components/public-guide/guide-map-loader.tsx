"use client";

import dynamic from "next/dynamic";

// Client-only boundary for the map. MapLibre touches `window` on import, so
// server-rendering it would throw. Next 15 disallows `dynamic({ ssr: false })`
// inside Server Components, so this wrapper exists purely to own that flag.
export const GuideMap = dynamic(
  () => import("../guide-map").then((m) => m.GuideMap),
  { ssr: false },
);
