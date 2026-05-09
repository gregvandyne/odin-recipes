"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * Toast notifications. Quiet, non-interruptive. Used sparingly: confirmations
 * for completed actions, never for engagement nudges.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      duration={3500}
      visibleToasts={3}
      toastOptions={{
        className:
          "rounded-md border border-border bg-canvas-card text-ink-primary shadow-soft",
        style: {
          fontFamily: "inherit",
          fontSize: "14px",
        },
      }}
    />
  );
}

export { toast };
