import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { MfaSetupClient } from "./mfa-setup-client";

/**
 * MFA setup. Shown post-sign-in for staff who haven't yet confirmed an
 * authenticator. The client component handles the multi-step flow:
 *   1. POST /api/auth/mfa/setup → otpauth URL + secret + recovery codes
 *   2. user scans QR / enters code
 *   3. POST /api/auth/mfa/confirm with the code
 */
export default async function MfaSetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in");
  return (
    <div className="mx-auto max-w-md px-6 py-8 space-y-4">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Account security</p>
        <h1 className="mt-2 text-display font-semibold text-ink-primary">
          Set up two-factor authentication.
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          Required for staff accounts. Use any RFC 6238 authenticator
          (1Password, Authy, Google Authenticator, …).
        </p>
      </header>
      <MfaSetupClient />
    </div>
  );
}
