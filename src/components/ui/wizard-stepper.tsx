import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wizard step indicator. Renders a horizontal sequence of numbered chips
 * with connecting lines. Past steps show a checkmark; the current step is
 * outlined; future steps are muted.
 *
 * On narrow viewports the labels truncate gracefully and the connecting
 * lines hide so the component fits a phone width.
 */

export interface Step<K extends string = string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  steps: readonly Step<K>[];
  current: K;
  /** ARIA label for the ordered list. Default "Setup progress". */
  ariaLabel?: string;
}

export function WizardStepper<K extends string>({
  steps,
  current,
  ariaLabel = "Setup progress",
}: Props<K>) {
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <ol
      className="flex items-center gap-1.5 sm:gap-2"
      aria-label={ariaLabel}
    >
      {steps.map((s, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <li
            key={s.key}
            className="flex flex-1 items-center gap-1.5 sm:gap-2"
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-caption font-semibold transition-colors",
                isPast
                  ? "bg-primary text-primary-foreground"
                  : isCurrent
                  ? "bg-primary/10 text-primary ring-2 ring-primary/40"
                  : "bg-canvas-banded text-ink-tertiary",
              )}
            >
              {isPast ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                "truncate text-caption",
                isCurrent
                  ? "font-semibold text-ink-primary"
                  : isPast
                  ? "text-ink-secondary"
                  : "text-ink-tertiary",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span
                className="ml-1 hidden h-px flex-1 bg-border sm:block"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
