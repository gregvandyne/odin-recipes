import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton placeholder. Used while a server component or client fetch is
 * resolving. The animation respects prefers-reduced-motion at the CSS level
 * via the existing tailwindcss-animate plugin.
 *
 * Variants:
 *   - line   : single text line (default)
 *   - block  : rectangular block (use width/height utilities)
 *   - circle : avatar-shaped
 */
export function Skeleton({
  className,
  variant = "line",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "line" | "block" | "circle" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse bg-canvas-banded motion-reduce:animate-none",
        variant === "line" && "h-3 w-full rounded",
        variant === "block" && "rounded-md",
        variant === "circle" && "rounded-full",
        className,
      )}
      {...props}
    />
  );
}
