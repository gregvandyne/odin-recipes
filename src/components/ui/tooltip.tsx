"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/**
 * Tooltip primitive. Use sparingly — never to convey information that's
 * required to complete a task. Best for clarifying icon-only buttons.
 *
 * Touch behavior: Radix tooltips don't open on touch by default. Buttons
 * that need a label on mobile should set `aria-label` *and* use a tooltip
 * for desktop hover.
 */

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 max-w-xs overflow-hidden rounded-md border border-border bg-canvas-card px-2.5 py-1.5 text-caption text-ink-primary shadow-soft",
      "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * Convenience wrapper. Pass `label` and the trigger as children:
 *   <Tooltip label="Send">
 *     <Button size="icon"><Send /></Button>
 *   </Tooltip>
 */
export function Tooltip({
  label,
  children,
  side = "bottom",
  delayDuration = 200,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayDuration?: number;
}) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}
