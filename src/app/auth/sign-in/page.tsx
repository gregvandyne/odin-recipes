import { SignInForm } from "./sign-in-form";
import { safeNextPath } from "@/lib/security/safe-redirect";

/**
 * Sign-in entry. Shown by NextAuth as the primary auth path. Magic link is
 * the default; staff with a `PasswordCredential` can opt into the password
 * subsection.
 *
 * The page reads searchParams server-side and hands them to SignInForm as
 * props so the form renders in the initial HTML — no JS required for first
 * paint. The form's interactive state lights up after hydration.
 *
 * callbackUrl is run through `safeNextPath` so a crafted query string can't
 * 302 a freshly-signed-in user to an attacker-controlled host.
 */
export default function SignInPage({
  searchParams,
}: {
  searchParams: { email?: string; callbackUrl?: string; next?: string };
}) {
  const callbackUrl = safeNextPath(
    searchParams.callbackUrl ?? searchParams.next,
    "/v",
  );
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Sentinel</p>
        <h1 className="mt-2 font-serif text-[34px] font-normal leading-tight tracking-[-0.015em] text-ink-primary">Sign in</h1>
        <p className="mt-2 text-body text-ink-secondary">
          We'll email you a one-time link. No passwords, unless you've set a backup.
        </p>
      </header>
      <SignInForm initialEmail={searchParams.email ?? ""} callbackUrl={callbackUrl} />
    </div>
  );
}
