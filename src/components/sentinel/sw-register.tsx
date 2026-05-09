"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on first load. The worker handles offline,
 * push delivery, and notification clicks. Subscription to push happens in a
 * separate, explicit user-initiated flow (NotificationOptIn) so we never
 * surprise the veteran with a permission prompt.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
