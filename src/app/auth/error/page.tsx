import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * NextAuth error landing. NextAuth redirects here on verification failures
 * with `?error=...` and we map the known codes to calm human copy.
 *
 * `Verification` is the most common arrival path — magic link expired or
 * already used. We treat the others as friendly fall-throughs so the user
 * isn't shown a code.
 */

interface Mapping {
  title: string;
  body: string;
}

function copyFor(code: string | undefined): Mapping {
  switch (code) {
    case "Verification":
      return {
        title: "That sign-in link can't be used.",
        body:
          "It may have expired or already been used. Links work once and expire after 15 minutes — request a new one and you'll be in.",
      };
    case "AccessDenied":
      return {
        title: "Something blocked sign-in.",
        body:
          "Your account isn't currently set up to sign in via that path. Try the magic-link option, or contact your program manager.",
      };
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCreateAccount":
    case "EmailCreateAccount":
    case "Callback":
      return {
        title: "We hit a snag completing sign-in.",
        body:
          "It's almost always temporary. Try again — and if it keeps failing, your program manager can help.",
      };
    case "SessionRequired":
      return {
        title: "You need to be signed in.",
        body: "Send yourself a one-time link and we'll get you back where you were.",
      };
    case "Configuration":
      return {
        title: "Something's not configured right.",
        body:
          "This isn't your fault. The platform team has been notified. Try again in a few minutes.",
      };
    default:
      return {
        title: "Something didn't work.",
        body:
          "We've recorded what happened. Try again — and if it keeps failing, your program manager can help.",
      };
  }
}

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const { title, body } = copyFor(searchParams.error);

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-canvas-banded text-ink-tertiary">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <header className="mt-4">
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Sign in</p>
        <h1 className="mt-2 font-serif text-[34px] font-normal leading-tight tracking-[-0.015em] text-ink-primary">{title}</h1>
        <p className="mt-3 text-body text-ink-secondary">{body}</p>
      </header>

      <Button asChild variant="primary" size="lg" className="mt-8 w-full justify-center">
        <Link href="/auth/sign-in">Send me a new link</Link>
      </Button>

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
