"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError, FieldHelpText, Input, Checkbox } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

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
  const [errors, setErrors] = useState<{
    displayName?: string;
    password?: string;
    confirmPassword?: string;
    consent?: string;
  }>({});

  function validate(): boolean {
    const e: typeof errors = {};
    if (!displayName.trim()) e.displayName = "Tell us how to address you.";
    if (isStaff && password) {
      if (password.length < 12) e.password = "Use at least 12 characters.";
      if (confirmPassword !== password) e.confirmPassword = "Passwords don't match.";
    }
    if (!consent) e.consent = "Please confirm consent to continue.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          displayName: displayName.trim() || undefined,
          password: isStaff && password ? password : undefined,
          consentVersion: CONSENT_VERSION,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(j.error || "Couldn't accept the invitation");
        return;
      }
      toast.success("Welcome to Sentinel.");
      router.push("/auth/sign-in?email=" + encodeURIComponent(email));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <div className="rounded-md border border-border bg-canvas-banded p-4">
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Inviting you</p>
        <p className="text-body text-ink-primary">{email}</p>
      </div>
      <Field>
        <FieldLabel>Your name</FieldLabel>
        <Input
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (errors.displayName) setErrors((er) => ({ ...er, displayName: undefined }));
          }}
          required
        />
        <FieldError>{errors.displayName}</FieldError>
      </Field>
      {isStaff && (
        <>
          <Field>
            <FieldLabel optional>Backup password (12+ characters)</FieldLabel>
            <Input
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((er) => ({ ...er, password: undefined }));
              }}
            />
            <FieldError>{errors.password}</FieldError>
            <FieldHelpText>
              Magic links are the primary way in. A backup password is only for if your inbox is
              briefly unavailable.
            </FieldHelpText>
          </Field>
          {password && (
            <Field>
              <FieldLabel>Confirm password</FieldLabel>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword)
                    setErrors((er) => ({ ...er, confirmPassword: undefined }));
                }}
              />
              <FieldError>{errors.confirmPassword}</FieldError>
            </Field>
          )}
        </>
      )}
      <Field>
        <Checkbox
          label={
            <>
              I've read the consent and I'm in. (You can withdraw at any time from your account
              settings.)
            </>
          }
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (errors.consent) setErrors((er) => ({ ...er, consent: undefined }));
          }}
        />
        <FieldError>{errors.consent}</FieldError>
      </Field>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={submitting}
        className="w-full justify-center"
      >
        {submitting ? (
          <>
            <Spinner size={16} /> Setting up…
          </>
        ) : (
          "Accept and continue"
        )}
      </Button>
    </form>
  );
}
