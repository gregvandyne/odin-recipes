"use client";

import * as React from "react";
import dynamic from "next/dynamic";

/**
 * Lazy host for the command palette. The full CommandPalette component
 * pulls in cmdk + the Dialog primitive which isn't worth the bytes on the
 * main staff-page bundle. We mount this tiny listener instead and only
 * dynamic-import the real palette when the user presses ⌘K for the first
 * time. After that it stays mounted so subsequent opens are instant.
 */
const CommandPalette = dynamic(
  () => import("./command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);

export function CommandPaletteHost() {
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (armed) return;
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        // Don't preventDefault here — the heavy palette's own listener will
        // handle the key once it mounts on the next tick.
        setArmed(true);
        window.removeEventListener("keydown", onKey);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

  if (!armed) return null;
  // Auto-open on first arming so the user's ⌘K press isn't dropped while we
  // mount the heavy bundle.
  return <CommandPalette defaultOpen />;
}
