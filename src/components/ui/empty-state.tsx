import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — shown when a list/section has no rows yet. Calm, supportive,
 * not gamified. Always pairs an icon with a title and optional helper text;
 * an action slot lets us point at the next step (e.g. "Add a veteran").
 */

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border bg-canvas-card px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-canvas-banded text-ink-tertiary">
          {icon}
        </div>
      )}
      <h2 className="text-body-lg font-semibold text-ink-primary">{title}</h2>
      {description && (
        <p className="mt-1 max-w-md text-body text-ink-secondary">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
