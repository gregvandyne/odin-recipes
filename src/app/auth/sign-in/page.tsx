import { SignInForm } from "./sign-in-form";

/**
 * Sign-in entry. Shown by NextAuth as the primary auth path. Magic link is
 * the default; staff with a `PasswordCredential` can opt into the password
 * subsection.
 *
 * The page reads searchParams server-side and hands them to SignInForm as
 * props so the form renders in the initial HTML — no JS required for first
 * paint. The form's interactive state lights up after hydration.
 */
export default function SignInPage({
  searchParams,
}: {
  searchParams: { email?: string; callbackUrl?: string; next?: string };
}) {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Sentinel</p>
        <h1 className="mt-2 text-display font-semibold text-ink-primary">Sign in</h1>
        <p className="mt-2 text-body text-ink-secondary">
          We'll email you a one-time link. No passwords, unless you've set a backup.
        </p>
      </header>
      <SignInForm
        initialEmail={searchParams.email ?? ""}
        callbackUrl={searchParams.callbackUrl ?? searchParams.next ?? "/v"}
      />
    </div>
  );
}
