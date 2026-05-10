"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SetupResponse {
  otpauthUrl: string;
  base32Secret: string;
  recoveryCodes: string[];
}

export function MfaSetupClient() {
  const router = useRouter();
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Couldn't start setup");
        return;
      }
      setSetup(j);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.replace(/\s+/g, "") }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "That code didn't match. Try again.");
        return;
      }
      router.push("/account/security");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!setup) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="h-12 w-full rounded-md bg-primary text-body font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? "Starting…" : "Start setup"}
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-canvas-card p-5">
        <h2 className="text-body font-semibold text-ink-primary">1. Add to your authenticator</h2>
        <p className="mt-1 text-caption text-ink-tertiary">
          Open your authenticator and add a new account. Either scan the QR code or paste the secret.
        </p>
        <div className="mt-3 break-all rounded-md bg-canvas-banded p-3 font-mono text-caption">
          {setup.base32Secret}
        </div>
        <p className="mt-2 text-caption text-ink-tertiary">
          Or use this URL: <span className="break-all">{setup.otpauthUrl}</span>
        </p>
      </section>

      <section className="rounded-lg border border-risk-orange/30 bg-risk-orange/5 p-5">
        <h2 className="text-body font-semibold text-ink-primary">2. Save your recovery codes</h2>
        <p className="mt-1 text-caption text-ink-tertiary">
          You'll see these once. Store them somewhere safe — they let you sign in if you lose your
          phone.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-caption">
          {setup.recoveryCodes.map((c) => (
            <li key={c} className="rounded bg-canvas-card px-2 py-1">{c}</li>
          ))}
        </ul>
        <label className="mt-3 inline-flex items-center gap-2 text-body text-ink-secondary">
          <input
            type="checkbox"
            checked={recoveryAcknowledged}
            onChange={(e) => setRecoveryAcknowledged(e.target.checked)}
          />
          I've saved these somewhere safe.
        </label>
      </section>

      <section className="rounded-lg border border-border bg-canvas-card p-5">
        <h2 className="text-body font-semibold text-ink-primary">3. Enter a code from your app</h2>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          className="mt-2 h-12 w-full rounded-md border border-border bg-canvas-card px-3 text-body font-mono"
        />
        {error && (
          <p className="mt-2 text-body text-crisis" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={confirm}
          disabled={busy || !recoveryAcknowledged || code.length < 6}
          className="mt-3 h-12 w-full rounded-md bg-primary text-body font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? "Confirming…" : "Confirm"}
        </button>
      </section>
    </div>
  );
}
