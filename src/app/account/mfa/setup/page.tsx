import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { MfaSetupClient } from "./mfa-setup-client";

/**
 * MFA setup. Shown post-sign-in for staff who haven't yet confirmed an
 * authenticator. The client component handles the multi-step flow:
 *   1. POST /api/auth/mfa/setup → otpauth URL + secret + recovery codes
 *   2. user scans QR / enters code
 *   3. POST /api/auth/mfa/confirm with the code
 *
 * `?required=1` is appended by requireMfaIfRequired() — when set we render
 * a soft banner explaining the user landed here because their org's MFA
 * enforcement level demands it.
 */
export default async function MfaSetupPage({
  searchParams,
}: {
  searchParams: { required?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in");
  const wasForced = searchParams.required === "1";
  return (
    <div className="mx-auto max-w-md px-6 py-8 space-y-4">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Account security</p>
        <h1 className="mt-2 text-display font-semibold text-ink-primary">
          Set up two-factor authentication.
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          Required for staff accounts. Use any RFC 6238 authenticator (1Password, Authy, Google
          Authenticator, …).
        </p>
      </header>
      {wasForced && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-md border border-risk-orange/30 bg-risk-orange/5 p-4"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-risk-orange" aria-hidden />
          <div className="text-body text-ink-primary">
            <p className="font-semibold">Your organization requires this.</p>
            <p className="mt-1 text-ink-secondary">
              We sent you here from a staff-only surface. Once you finish setup, you'll be back
              where you were headed.
            </p>
          </div>
        </div>
      )}
      <MfaSetupClient />
    </div>
  );
}
