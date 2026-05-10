"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/v";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function submitMagic(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("email", email);
      params.set("callbackUrl", callbackUrl);
      const res = await fetch("/api/auth/signin/email", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        redirect: "manual",
      });
      // NextAuth returns 302 on success.
      if (res.status >= 200 && res.status < 400) {
        setMagicSent(true);
      } else {
        setError("We couldn't send the link. Try again.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password-sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error === "magic_link_only" ? "Use the magic-link link above." : "Invalid credentials.");
        return;
      }
      // The route validates only — NextAuth still owns the session. Send the
      // user to the magic-link path next so they receive an email and finish
      // sign-in. Future: a CredentialsProvider would do this in one step.
      router.push("/auth/check-email?email=" + encodeURIComponent(email));
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (magicSent) {
    return (
      <div className="mt-8 rounded-lg border border-border bg-canvas-card p-5">
        <p className="text-body font-semibold text-ink-primary">Check your inbox.</p>
        <p className="mt-1 text-body text-ink-secondary">
          We sent a one-time link to {email}. It works once and expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <form onSubmit={submitMagic} className="space-y-3" aria-label="Sign in by email link">
        <label className="block">
          <span className="text-caption font-semibold text-ink-secondary">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-12 w-full rounded-md border border-border bg-canvas-card px-3 text-body text-ink-primary"
          />
        </label>
        <button
          type="submit"
          disabled={submitting || !email}
          className="h-12 w-full rounded-md bg-primary text-body font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send sign-in link"}
        </button>
      </form>

      <details className="rounded-lg border border-border bg-canvas-banded p-4 open:bg-canvas-card">
        <summary
          className="cursor-pointer text-body text-ink-secondary"
          onClick={() => setShowPassword((s) => !s)}
        >
          Use a password instead (staff only)
        </summary>
        {showPassword && (
          <form onSubmit={submitPassword} className="mt-3 space-y-3" aria-label="Sign in with password">
            <label className="block">
              <span className="text-caption font-semibold text-ink-secondary">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-12 w-full rounded-md border border-border bg-canvas-card px-3 text-body text-ink-primary"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="h-10 w-full rounded-md bg-canvas-card border border-border text-body font-semibold text-ink-primary hover:bg-canvas-banded disabled:opacity-60"
            >
              Continue with password
            </button>
          </form>
        )}
      </details>

      {error && (
        <p className="text-body text-crisis" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
