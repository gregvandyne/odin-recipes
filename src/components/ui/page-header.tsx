import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared page header. Eyebrow text + display title + optional description and
 * a slot for actions on the right. Used across staff and veteran surfaces so
 * type sizes and spacing stay consistent.
 *
 * Stacks gracefully on mobile: actions move below the title block at < sm.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-caption uppercase tracking-wide text-ink-tertiary">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-display font-semibold text-ink-primary">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-body text-ink-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
