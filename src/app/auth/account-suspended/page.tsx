/**
 * Shown when a sign-in attempts to land on the app but the account is no
 * longer ACTIVE. The middleware/session callback redirects here with a
 * `reason` querystring so the user knows what happened.
 */
import Link from "next/link";

export default function AccountSuspendedPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <p className="text-caption uppercase tracking-wide text-ink-tertiary">Sentinel</p>
      <h1 className="mt-2 text-display font-semibold text-ink-primary">
        This account is paused.
      </h1>
      <p className="mt-3 text-body text-ink-secondary">
        Your access has been suspended. {searchParams.reason ? `Reason: ${searchParams.reason}.` : ""}
        {" "}If you believe this is in error, contact your program manager.
      </p>
      <p className="mt-6 text-body text-ink-secondary">
        In a crisis, call <a href="tel:988" className="font-semibold text-crisis">988</a> and press 1.
      </p>
      <Link
        href="/auth/sign-in"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-md border border-border bg-canvas-card px-6 text-body text-ink-primary hover:bg-canvas-banded"
      >
        Back to sign-in
      </Link>
    </div>
  );
}
