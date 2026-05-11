import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { MfaChallengeForm } from "./challenge-form";

/**
 * MFA challenge / step-up.
 *
 * Reached after sign-in for staff with MFA enabled, or via a sensitive
 * action (severity override, deactivate, audit export) when their session
 * doesn't have a fresh `mfaCompletedAt`. Posts to /api/auth/mfa/challenge.
 *
 * `?next=/path` is the post-success destination.
 */
export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in");
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
        <ShieldCheck className="h-5 w-5" aria-hidden />
      </div>
      <header className="mt-4">
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Verification</p>
        <h1 className="mt-1 text-display font-semibold text-ink-primary">
          Confirm it's you.
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          Enter the 6-digit code from your authenticator. Lost your device? Use a recovery
          code instead.
        </p>
      </header>
      <MfaChallengeForm next={safeNextPath(searchParams.next, "/coordinator")} />
      <p className="mt-8 text-caption text-ink-tertiary">
        Locked out?{" "}
        <Link
          href="/auth/sign-in"
          className="rounded text-ink-secondary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Start over
        </Link>
      </p>
    </div>
  );
}
