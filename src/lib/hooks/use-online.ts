"use client";

import * as React from "react";

/**
 * Track navigator.onLine. SSR-safe: starts as `true` (assume online)
 * and updates after mount via the `online` / `offline` events.
 */
export function useOnline(): boolean {
  const [online, setOnline] = React.useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });
  React.useEffect(() => {
    function update() {
      setOnline(navigator.onLine);
    }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
