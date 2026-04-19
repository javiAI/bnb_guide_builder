import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GUIDE_PWA_STATIC_ASSETS } from "@/lib/client/sw-precache-manifest";

const PUBLIC_DIR = join(__dirname, "..", "..", "public");

describe("guide PWA precache manifest", () => {
  it("lists at least the three required PWA icons", () => {
    expect(GUIDE_PWA_STATIC_ASSETS).toEqual(
      expect.arrayContaining([
        "/icons/guide-192.png",
        "/icons/guide-512.png",
        "/icons/guide-512-maskable.png",
      ]),
    );
  });

  it("each entry resolves to an existing file under public/", () => {
    for (const path of GUIDE_PWA_STATIC_ASSETS) {
      const onDisk = join(PUBLIC_DIR, path.replace(/^\//, ""));
      expect(existsSync(onDisk), `missing static asset: ${path}`).toBe(true);
    }
  });
});
