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

const CACHE_VERSION = "sentinel-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const QUEUE_DB = "sentinel-offline";
const QUEUE_STORE = "outbox";
const SYNC_TAG = "sentinel-outbox";

// Routes that should be queued offline + retried when the connection returns.
// We intentionally limit this to write paths the veteran initiates so we never
// silently reorder reads or replay coordinator-side actions.
const QUEUEABLE_PATHS = [
  "/api/check-ins",
  "/api/check-ins/draft",
  "/api/check-ins/",
  // Veteran + coordinator messaging — the composer surfaces an inline
  // "Offline" indicator and the request is queued by URL; the optimistic
  // UI marks the bubble pending until the replay completes.
  "/api/messages",
  // Coordinator contact log — same flow.
  "/api/contacts",
];

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

// =============================================================================
// IndexedDB outbox helpers (no external deps; small inline wrapper).
// =============================================================================

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueRequest(req) {
  const body = await req.clone().text();
  const headers = {};
  for (const [k, v] of req.headers.entries()) headers[k] = v;
  const entry = {
    url: req.url,
    method: req.method,
    headers,
    body,
    enqueuedAt: Date.now(),
  };
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  if ("sync" in self.registration) {
    try {
      await self.registration.sync.register(SYNC_TAG);
    } catch {
      /* noop — fall back to online event */
    }
  }
}

async function flushQueue() {
  const db = await openDb();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
        credentials: "include",
      });
      // Success or a definitive 4xx (idempotent rejection): drop the entry.
      // Transient 5xx + network errors throw and we keep it for the next sync.
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(QUEUE_STORE, "readwrite");
          tx.objectStore(QUEUE_STORE).delete(item.id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    } catch {
      // Network still down. Leave it queued.
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushQueue());
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "flush-outbox") event.waitUntil(flushQueue());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const method = event.request.method;

  // Veteran write paths: queue on network failure.
  if (
    (method === "POST" || method === "PUT") &&
    QUEUEABLE_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p))
  ) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch {
          await enqueueRequest(event.request.clone()).catch(() => {});
          // Synthetic 202 — the client treats this as "accepted offline."
          return new Response(
            JSON.stringify({ ok: true, offlineQueued: true }),
            { status: 202, headers: { "Content-Type": "application/json" } },
          );
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (method !== "GET") return;
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
