"use client";

import { useEffect, useState } from "react";

/** Module-level promise cache. The MapTiler style URL returned by
 * `/api/geo/tiles-config` is static for the session — multiple concurrent
 * mounts dedupe to one network round-trip and subsequent mounts reuse the
 * resolved value. */
let tilesConfigPromise: Promise<string | null> | null = null;

function fetchTilesStyleUrl(): Promise<string | null> {
  if (!tilesConfigPromise) {
    tilesConfigPromise = fetch("/api/geo/tiles-config")
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((data: { styleUrl?: unknown }) =>
        typeof data.styleUrl === "string" ? data.styleUrl : null,
      )
      .catch(() => {
        // Cached failure does NOT survive — clear the promise so the next
        // mount retries. A persistent 503 (missing MAPTILER_API_KEY) is the
        // expected path; transient network failures should self-heal.
        tilesConfigPromise = null;
        return null;
      });
  }
  return tilesConfigPromise;
}

/** Fetches the MapTiler style URL exposed by `/api/geo/tiles-config`. Returns
 * `{ styleUrl, error }`. `error` is non-null when the server responded with
 * an unusable payload (missing key, transient failure); callers should render
 * a textual fallback rather than mounting MapLibre. */
export function useTilesStyleUrl(): {
  styleUrl: string | null;
  error: string | null;
} {
  const [styleUrl, setStyleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTilesStyleUrl().then((url) => {
      if (cancelled) return;
      if (url) setStyleUrl(url);
      else setError("Mapa no disponible");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { styleUrl, error };
}
