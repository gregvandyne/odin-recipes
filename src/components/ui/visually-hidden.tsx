import * as React from "react";

/**
 * Visually hidden text — read by screen readers, invisible to sighted users.
 * Used to give icon-only buttons accessible names without disturbing layout.
 *
 * The Tailwind `sr-only` class is the standard implementation. We wrap it so
 * intent is obvious in code review.
 */
export function VisuallyHidden({
  asChild,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(props.children)) {
    return React.cloneElement(
      props.children as React.ReactElement<{ className?: string }>,
      { className: `sr-only ${(props.children as React.ReactElement<{ className?: string }>).props.className ?? ""}` },
    );
  }
  return <span className="sr-only" {...props} />;
}
