import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Inline spinner for loading buttons / async actions.
 *
 * Uses an SVG circle so the stroke and the dash array make a clean
 * three-quarters arc. Defaults to `currentColor` so it inherits whatever
 * button variant it's nested in.
 *
 * `aria-hidden`: when paired with a label like "Saving…" the visual cue is
 * decorative. For icon-only loading states, wrap in a parent with
 * `aria-label` or use `<VisuallyHidden>` text.
 */
export function Spinner({
  className,
  size = 16,
  ...props
}: React.SVGAttributes<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      role="img"
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("animate-spin motion-reduce:animate-none", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="42 14"
        opacity={0.85}
      />
    </svg>
  );
}
