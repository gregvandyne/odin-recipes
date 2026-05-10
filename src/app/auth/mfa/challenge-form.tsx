"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError, FieldHelpText, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

const TOTP_RE = /^\d{6}$/;
const RECOVERY_RE = /^[A-Z0-9-]{6,20}$/i;

export function MfaChallengeForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"totp" | "recovery">("totp");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const valid =
    mode === "totp"
      ? TOTP_RE.test(code.replace(/\s+/g, ""))
      : RECOVERY_RE.test(code.replace(/\s+/g, ""));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const cleaned = code.replace(/\s+/g, "");
      const res = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "totp" ? { code: cleaned } : { recoveryCode: cleaned },
        ),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          mode === "totp"
            ? "That code didn't match. Try again."
            : "That recovery code didn't work — it may already be used.",
        );
        return;
      }
      toast.success("Verified.");
      router.push(next);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <Field>
        <FieldLabel>{mode === "totp" ? "6-digit code" : "Recovery code"}</FieldLabel>
        <Input
          type="text"
          inputMode={mode === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          placeholder={mode === "totp" ? "123 456" : "AB12C-DE34F"}
          maxLength={mode === "totp" ? 9 : 16}
          className="font-mono tracking-widest"
          autoFocus
        />
        <FieldError>{error}</FieldError>
        {mode === "totp" && (
          <FieldHelpText>
            Codes refresh every 30 seconds. We accept the current one and the previous one.
          </FieldHelpText>
        )}
      </Field>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full justify-center"
        disabled={submitting || !valid}
      >
        {submitting ? (
          <>
            <Spinner size={16} /> Verifying…
          </>
        ) : (
          "Verify"
        )}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "totp" ? "recovery" : "totp"));
          setCode("");
          setError(null);
        }}
        className="rounded text-caption text-ink-secondary underline-offset-4 hover:text-ink-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {mode === "totp" ? "Use a recovery code instead" : "Use a 6-digit code instead"}
      </button>
    </form>
  );
}
