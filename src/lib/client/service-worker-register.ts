"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister({ slug }: { slug: string }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const swUrl = `/g/${slug}/sw.js`;
    const scope = `/g/${slug}/`;

    let cancelled = false;
    navigator.serviceWorker
      .register(swUrl, { scope })
      .then((reg) => {
        if (cancelled) return;
        const waiting = reg.waiting;
        if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              installing.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch((err) => {
        console.warn(`[guide-sw] register failed for ${swUrl}`, err);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return null;
}
