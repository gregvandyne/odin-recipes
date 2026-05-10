"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary. Caught by Next.js when a server component, route
 * handler, or page throws unexpectedly. We deliberately keep the copy calm
 * and concrete — a veteran or coordinator who lands here shouldn't be
 * shown a stack trace.
 *
 * The original error is reported to the observability layer (pino + Sentry
 * via the route's withErrorTracking wrapper). We surface a digest hash so
 * support can correlate the user's report with logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Best-effort client-side log so the error reaches Sentry when the
    // boundary catches a render-time crash.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-canvas-banded text-ink-tertiary">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-display font-semibold text-ink-primary">
        Something didn't load.
      </h1>
      <p className="mt-3 text-body text-ink-secondary">
        We've recorded what happened. The simplest fix is usually to try again — and if it
        keeps failing, your coordinator can help.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-caption text-ink-tertiary">
          ref: <span className="text-ink-secondary">{error.digest}</span>
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => reset()}>
          Try again
        </Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/")}>
          Back to start
        </Button>
      </div>
      <p className="mt-8 text-caption text-ink-tertiary">
        In a crisis, call{" "}
        <a href="tel:988" className="font-semibold text-crisis hover:underline">
          988
        </a>{" "}
        and press 1 — Veterans Crisis Line, 24/7.
      </p>
    </div>
  );
}
