"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, KeyRound, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/v";
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const emailValid = EMAIL_RE.test(email.trim());
  const showEmailError = emailTouched && !emailValid;

  async function submitMagic(e: React.FormEvent) {
    e.preventDefault();
    setEmailTouched(true);
    if (!emailValid || submitting) return;
    setSubmitting(true);
    try {
      const body = new URLSearchParams();
      body.set("email", email);
      body.set("callbackUrl", callbackUrl);
      const res = await fetch("/api/auth/signin/email", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        redirect: "manual",
      });
      // NextAuth replies with a 302 on success.
      if (res.status >= 200 && res.status < 400) {
        setMagicSent(true);
        toast.success("Sign-in link sent.");
      } else {
        toast.error("We couldn't send the link. Try again in a moment.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setEmailTouched(true);
    if (!emailValid || !password || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.error === "magic_link_only") {
          toast.message("This account uses magic-link sign-in. Send a link instead.");
        } else if (json.error === "account_not_active") {
          toast.error("This account is paused.");
          router.push("/auth/account-suspended");
        } else if (json.error === "account_locked") {
          toast.error("This account is temporarily locked. Try again in a few minutes.");
        } else {
          toast.error("Invalid credentials.");
        }
        return;
      }
      toast.success("Verified. Sending the sign-in link to finish.");
      router.push("/auth/check-email?email=" + encodeURIComponent(email));
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (magicSent) {
    return (
      <div className="mt-8 rounded-lg border border-border bg-canvas-card p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-body-lg font-semibold text-ink-primary">Check your inbox.</p>
            <p className="mt-1 text-body text-ink-secondary">
              A one-time link is on its way to <span className="font-semibold">{email}</span>. It
              works once and expires in 15 minutes.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-caption text-ink-tertiary">
          <button
            type="button"
            onClick={() => setMagicSent(false)}
            className="rounded px-1 underline-offset-4 hover:text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Use a different email
          </button>
          <span aria-hidden>·</span>
          <Link
            href={`/auth/check-email?email=${encodeURIComponent(email)}`}
            className="rounded px-1 underline-offset-4 hover:text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Trouble? See the troubleshooting guide
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <form
        onSubmit={passwordOpen ? submitPassword : submitMagic}
        className="space-y-3"
        noValidate
        aria-label="Sign in"
      >
        <Field>
          <FieldLabel>Email</FieldLabel>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            placeholder="you@example.com"
            required
          />
          <FieldError>{showEmailError ? "Enter a valid email address." : ""}</FieldError>
        </Field>

        {passwordOpen && (
          <Field>
            <FieldLabel>Password</FieldLabel>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full justify-center"
          disabled={submitting || !emailValid || (passwordOpen && !password)}
        >
          {submitting ? (
            <>
              <Spinner size={16} /> Sending…
            </>
          ) : passwordOpen ? (
            <>
              <KeyRound className="h-4 w-4" aria-hidden /> Continue with password
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" aria-hidden /> Send sign-in link
            </>
          )}
        </Button>
      </form>

      <div className="border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setPasswordOpen((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded px-1 text-caption text-ink-secondary underline-offset-4 hover:text-ink-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={passwordOpen}
        >
          {passwordOpen ? "Use a sign-in link instead" : "Use a password instead"}
          <ChevronRight
            className={`h-3 w-3 transition-transform ${passwordOpen ? "rotate-90" : ""}`}
            aria-hidden
          />
        </button>
        <p className="mt-2 text-caption text-ink-tertiary">
          Password sign-in is staff-only. Veterans always sign in with a one-time link.
        </p>
      </div>

      <p className="text-caption text-ink-tertiary">
        In a crisis, call{" "}
        <a href="tel:988" className="font-semibold text-crisis hover:underline">
          988
        </a>{" "}
        and press 1 — Veterans Crisis Line, 24/7.
      </p>
    </div>
  );
}
