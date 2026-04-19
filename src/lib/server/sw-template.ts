/**
 * Service worker template (rama 10I). Lives outside `public/` on purpose:
 * any file under `public/` would be served at `/sw.js` with default scope `/`,
 * which contradicts the per-slug isolation decided in MASTER_PLAN_V2 §10I
 * and would risk caching one property's responses under another's scope.
 *
 * The route handler at `src/app/g/[slug]/sw.js/route.ts` substitutes
 * `__SLUG__` and `__SW_VERSION__`, then serves the rendered string with
 * `Cache-Control: no-cache` + `Service-Worker-Allowed` so the browser
 * re-fetches on every navigation and triggers `update` whenever
 * `__SW_VERSION__` (= `GuideSearchIndex.buildVersion` from rama 10H) flips.
 */

export const SW_TEMPLATE_PLACEHOLDERS = {
  slug: "__SLUG__",
  version: "__SW_VERSION__",
} as const;

export const SW_TEMPLATE = `/* eslint-disable */
/* Service worker for /g/__SLUG__/ — version __SW_VERSION__ */
/* global self, caches, fetch, Request, Response, URL */

const SLUG = "__SLUG__";
const VERSION = "__SW_VERSION__";
const SCOPE_PREFIX = "/g/" + SLUG + "/";

const CACHE_TIER1 = "guide-" + SLUG + "-tier1-" + VERSION;
const CACHE_TIER2 = "guide-" + SLUG + "-tier2-" + VERSION;
const CACHE_TIER3 = "guide-" + SLUG + "-tier3-" + VERSION;

const TIER2_MAX_ENTRIES = 12;
const TIER3_NETWORK_TIMEOUT_MS = 2000;

const PRECACHE_TIER1 = [
  SCOPE_PREFIX,
  SCOPE_PREFIX + "offline",
  SCOPE_PREFIX + "manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_TIER1).then((cache) =>
      Promise.all(
        PRECACHE_TIER1.map((url) =>
          fetch(url, { credentials: "same-origin" })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null),
        ),
      ),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) =>
            key.startsWith("guide-" + SLUG + "-tier") &&
            key !== CACHE_TIER1 &&
            key !== CACHE_TIER2 &&
            key !== CACHE_TIER3,
          )
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PREFIX) && !url.pathname.startsWith("/_next/static/") && !url.pathname.startsWith("/icons/")) {
    return;
  }

  // Navigation requests (HTML): stale-while-revalidate + offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Tier 2 — media thumbnails (SWR with cap).
  if (isThumbRequest(url)) {
    event.respondWith(handleSwrCapped(request, CACHE_TIER2, TIER2_MAX_ENTRIES));
    return;
  }

  // Tier 3 — media md/full (network-first w/ timeout, fallback cache).
  if (isMediaRequest(url)) {
    event.respondWith(handleNetworkFirst(request, CACHE_TIER3, TIER3_NETWORK_TIMEOUT_MS));
    return;
  }

  // Tier 1 — Next static assets, icons, manifest (cache-first).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.endsWith("/manifest.webmanifest")) {
    event.respondWith(handleCacheFirst(request, CACHE_TIER1));
    return;
  }
});

function isThumbRequest(url) {
  return url.pathname.startsWith(SCOPE_PREFIX + "media/") && url.pathname.endsWith("/thumb");
}

function isMediaRequest(url) {
  return url.pathname.startsWith(SCOPE_PREFIX + "media/") && !url.pathname.endsWith("/thumb");
}

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_TIER1);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }
  const networkRes = await networkPromise;
  if (networkRes) return networkRes;
  const fallback = await cache.match(SCOPE_PREFIX + "offline");
  return fallback || new Response("Sin conexión", { status: 503 });
}

async function handleCacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}

async function handleSwrCapped(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) {
        cache.put(request, res.clone()).then(() => trimCache(cacheName, maxEntries));
      }
      return res;
    })
    .catch(() => null);
  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }
  const res = await networkPromise;
  return res || Response.error();
}

async function handleNetworkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  const networkPromise = fetch(request).then((res) => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  });
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve(null), timeoutMs),
  );
  try {
    const res = await Promise.race([networkPromise, timeoutPromise]);
    if (res) return res;
  } catch {
    /* fall through to cache */
  }
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    return await networkPromise;
  } catch {
    return Response.error();
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
}
`;

/** Substitute placeholders in the SW template. Both substitutions are
 * required — leaving a literal `__SLUG__` or `__SW_VERSION__` in the served
 * SW would silently break per-slug isolation or cache versioning. */
export function renderSwTemplate(input: {
  slug: string;
  version: string;
}): string {
  if (!input.slug) throw new Error("renderSwTemplate: slug is required");
  if (!input.version) throw new Error("renderSwTemplate: version is required");
  return SW_TEMPLATE.replaceAll(SW_TEMPLATE_PLACEHOLDERS.slug, input.slug).replaceAll(
    SW_TEMPLATE_PLACEHOLDERS.version,
    input.version,
  );
}
