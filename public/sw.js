/**
 * Sentinel service worker.
 *
 * Conservative caching:
 *  - precache the app shell so the veteran app opens offline with the calm
 *    "you're offline" state rather than a network error
 *  - never cache API responses (privacy + correctness)
 *  - never cache HTML pages with auth state — always go to network
 *
 * Web Push handler: receive push, derive tag and url, render notification.
 * iOS PWAs require notifications to be triggered while the page is hidden;
 * this works once the user has installed to home screen.
 */

const CACHE_VERSION = "sentinel-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (event.request.method !== "GET") return;
  // Network-first for HTML, cache-first for static assets we precached.
  if (event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/").then((cached) => cached || new Response("offline", { status: 503 })),
      ),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request),
    ),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Sentinel", body: event.data.text() };
  }
  const title = payload.title || "Sentinel";
  const options = {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: payload.tag,
    data: { url: payload.url || "/" },
    // Quiet by default. Critical (RED) notifications can request vibrate.
    vibrate: payload.priority === "critical" ? [60, 30, 60] : undefined,
    silent: payload.priority === "low",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const c of all) {
        if (c.url.endsWith(target) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
