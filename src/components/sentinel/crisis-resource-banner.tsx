import { Phone, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Crisis resource banner.
 *
 * Persistent on every veteran-facing screen. Always one tap from anywhere.
 * Never gated. Never hidden behind a menu. Crisis red, distinct from risk-red.
 *
 * Variants:
 *   compact — bottom strip on every veteran screen
 *   full    — onboarding & messaging surfaces
 *   inline  — inline within a flow (e.g., check-in completion)
 */
export function CrisisResourceBanner({
  variant = "compact",
  className,
}: {
  variant?: "compact" | "full" | "inline";
  className?: string;
}) {
  if (variant === "full") {
    return (
      <aside
        role="region"
        aria-label="Crisis resources"
        className={cn(
          "rounded-lg border border-crisis/40 bg-crisis/5 p-6",
          className,
        )}
      >
        <h2 className="text-body-lg font-semibold text-crisis">If you're in crisis</h2>
        <p className="mt-2 text-body text-ink-primary">
          You can reach a counselor any time, day or night. You don't have to be in crisis to use these.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a
            href="tel:988"
            className="inline-flex items-center gap-2 rounded-md bg-crisis px-4 py-3 text-body font-semibold text-crisis-foreground hover:opacity-90"
          >
            <Phone className="h-4 w-4" aria-hidden />
            Call 988, press 1
          </a>
          <a
            href="sms:838255"
            className="inline-flex items-center gap-2 rounded-md border border-crisis/60 px-4 py-3 text-body font-semibold text-crisis hover:bg-crisis/10"
          >
            <MessageSquare className="h-4 w-4" aria-hidden />
            Text 838255
          </a>
        </div>
      </aside>
    );
  }

  if (variant === "inline") {
    return (
      <p className={cn("text-caption text-ink-secondary", className)}>
        In crisis?{" "}
        <a href="tel:988" className="font-semibold text-crisis underline-offset-2 hover:underline">
          Call 988, press 1
        </a>
        .
      </p>
    );
  }

  // compact — persistent bottom banner
  return (
    <div
      role="region"
      aria-label="Crisis resources"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-crisis/30 bg-canvas-card/95 backdrop-blur-sm",
        className,
      )}
    >
      <div className="container flex items-center justify-between gap-3 py-2">
        <span className="text-caption text-ink-secondary">
          Veterans Crisis Line
        </span>
        <a
          href="tel:988"
          className="inline-flex items-center gap-1.5 text-caption font-semibold text-crisis hover:underline"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden />
          988, press 1
        </a>
      </div>
    </div>
  );
}
