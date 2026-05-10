"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  token: string;
  email: string;
  role: "VETERAN" | "COORDINATOR" | "CLINICAL_LEAD" | "PROGRAM_MANAGER" | "SUPER_ADMIN";
}

const CONSENT_VERSION = "1.0.0";

export function AcceptForm({ token, email, role }: Props) {
  const router = useRouter();
  const isStaff = role !== "VETERAN";
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError("Please confirm consent to continue.");
      return;
    }
    if (isStaff && password && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          displayName: displayName || undefined,
          password: isStaff && password ? password : undefined,
          consentVersion: CONSENT_VERSION,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Couldn't accept the invitation");
        return;
      }
      // Now sign the user in via magic link so the session is minted.
      router.push("/auth/sign-in?email=" + encodeURIComponent(email));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="rounded-md border border-border bg-canvas-banded p-4">
        <p className="text-caption text-ink-tertiary">Inviting you</p>
        <p className="text-body text-ink-primary">{email}</p>
      </div>
      <label className="block">
        <span className="text-caption font-semibold text-ink-secondary">Your name</span>
        <input
          type="text"
          required
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1 h-12 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
        />
      </label>
      {isStaff && (
        <>
          <label className="block">
            <span className="text-caption font-semibold text-ink-secondary">
              Backup password (optional, 12+ characters)
            </span>
            <input
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-12 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
            />
          </label>
          {password && (
            <label className="block">
              <span className="text-caption font-semibold text-ink-secondary">Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 h-12 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
              />
            </label>
          )}
        </>
      )}
      <label className="flex items-start gap-2 text-body text-ink-secondary">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <span>
          I've read the consent and I'm in. (You can withdraw at any time from your account
          settings.)
        </span>
      </label>
      {error && (
        <p className="text-body text-crisis" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="h-12 w-full rounded-md bg-primary text-body font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {submitting ? "Setting up…" : "Accept and continue"}
      </button>
    </form>
  );
}
