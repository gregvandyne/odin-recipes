import Link from "next/link";
import { Mail, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * NextAuth `verifyRequest` target. Shown after a magic-link is sent.
 *
 * We deliberately keep this server-rendered + static. The email param is
 * read straight off the query string and rendered for context — it never
 * leaves the browser and isn't echoed back in a way an open-redirect or
 * reflected-XSS could abuse (CSP `script-src 'self' 'nonce-…' 'strict-dynamic'`
 * blocks any inline injection regardless).
 */
export default function CheckEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = (searchParams.email ?? "").slice(0, 254);

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Inbox className="h-5 w-5" aria-hidden />
      </div>

      <header className="mt-4">
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Sign in</p>
        <h1 className="mt-2 font-serif text-[34px] font-normal leading-tight tracking-[-0.015em] text-ink-primary">Check your inbox.</h1>
        <p className="mt-3 text-body text-ink-secondary">
          A one-time sign-in link is on its way
          {email ? (
            <>
              {" "}
              to <span className="font-semibold text-ink-primary">{email}</span>
            </>
          ) : null}
          . The link works once and expires in 15 minutes.
        </p>
      </header>

      <ul className="mt-6 space-y-2 text-body text-ink-secondary">
        <li className="flex gap-2">
          <span aria-hidden className="text-ink-tertiary">·</span>
          <span>If you don't see it within a minute, check spam.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-ink-tertiary">·</span>
          <span>If the address was wrong, head back and try again.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-ink-tertiary">·</span>
          <span>You can close this tab — the link works from any browser.</span>
        </li>
      </ul>

      <Button asChild variant="secondary" size="lg" className="mt-8 w-full justify-center">
        <Link href="/auth/sign-in">
          <Mail className="h-4 w-4" aria-hidden /> Use a different email
        </Link>
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
