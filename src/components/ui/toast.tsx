"use client";

import * as React from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * Toast notifications. Quiet, non-interruptive. Used sparingly: confirmations
 * for completed actions, never for engagement nudges.
 *
 * Position is responsive: bottom-center on phones (so a fat thumb doesn't
 * clip notifications under a notch and so it doesn't fight the iOS dynamic
 * island), top-center on tablet/desktop where there's empty space.
 */
export function Toaster() {
  const [position, setPosition] = React.useState<
    "top-center" | "bottom-center"
  >("top-center");

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setPosition(mq.matches ? "bottom-center" : "top-center");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <SonnerToaster
      position={position}
      duration={3500}
      visibleToasts={3}
      offset="16px"
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
