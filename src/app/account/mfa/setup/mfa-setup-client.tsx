"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, KeyRound, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError, FieldHelpText, Input, Checkbox } from "@/components/ui/field";
import { CopyButton } from "@/components/ui/copy-button";
import { QrCode } from "@/components/ui/qr-code";
import { Spinner } from "@/components/ui/spinner";
import { WizardStepper } from "@/components/ui/wizard-stepper";
import { toast } from "@/components/ui/toast";

interface SetupResponse {
  otpauthUrl: string;
  base32Secret: string;
  recoveryCodes: string[];
}

const STEPS = [
  { key: "start", label: "Get started" },
  { key: "scan", label: "Scan + save" },
  { key: "confirm", label: "Verify" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function MfaSetupClient() {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>("start");
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Couldn't start setup");
        return;
      }
      setSetup(j);
      setStep("scan");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    setCodeError(null);
    try {
      const cleaned = code.replace(/\s+/g, "");
      const res = await fetch("/api/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleaned }),
      });
      const j = await res.json();
      if (!res.ok) {
        setCodeError(
          j.error === "invalid code"
            ? "That code didn't match. Try again."
            : j.error || "Couldn't confirm",
        );
        return;
      }
      toast.success("Two-factor authentication is on.");
      router.push("/account/security");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <WizardStepper steps={STEPS} current={step} />

      {step === "start" && (
        <section className="space-y-3 rounded-lg border border-border bg-canvas-card p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Shield className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-body-lg font-semibold text-ink-primary">Add a second factor</h2>
              <p className="mt-1 text-body text-ink-secondary">
                You'll use an authenticator app for sensitive actions: severity overrides,
                deactivations, audit exports.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={start}
            disabled={busy}
            className="w-full justify-center sm:w-auto"
          >
            {busy ? (
              <>
                <Spinner size={16} /> Setting up…
              </>
            ) : (
              "Start setup"
            )}
          </Button>
        </section>
      )}

      {step === "scan" && setup && (
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <section className="rounded-lg border border-border bg-canvas-card p-5">
            <h2 className="flex items-center gap-2 text-body-lg font-semibold text-ink-primary">
              <ScanLine className="h-4 w-4 text-ink-secondary" aria-hidden /> Scan the QR
            </h2>
            <p className="mt-1 text-caption text-ink-tertiary">
              Or paste the secret manually if you can't scan.
            </p>
            <div className="mt-3 flex justify-center">
              <QrCode value={setup.otpauthUrl} size={192} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-canvas-banded px-2 py-1 font-mono text-caption text-ink-primary">
                {setup.base32Secret}
              </code>
              <CopyButton value={setup.base32Secret} label="Copy secret" />
            </div>
          </section>

          <section className="rounded-lg border border-risk-orange/30 bg-risk-orange/5 p-5">
            <h2 className="flex items-center gap-2 text-body-lg font-semibold text-ink-primary">
              <KeyRound className="h-4 w-4 text-risk-orange" aria-hidden /> Save your recovery codes
            </h2>
            <p className="mt-1 text-caption text-ink-tertiary">
              You'll see these once. Store them somewhere safe — they let you sign in if you lose
              your device.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-caption">
              {setup.recoveryCodes.map((c) => (
                <li
                  key={c}
                  className="rounded border border-border bg-canvas-card px-2 py-1 text-ink-primary"
                >
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <CopyButton value={setup.recoveryCodes.join("\n")} label="Copy all codes" />
              <Checkbox
                label="I've saved these somewhere safe"
                checked={recoveryAcknowledged}
                onChange={(e) => setRecoveryAcknowledged(e.target.checked)}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="primary"
                onClick={() => setStep("confirm")}
                disabled={!recoveryAcknowledged}
              >
                Next: verify
              </Button>
            </div>
          </section>
        </div>
      )}

      {step === "confirm" && (
        <section className="rounded-lg border border-border bg-canvas-card p-5">
          <h2 className="text-body-lg font-semibold text-ink-primary">
            Enter a code from your app
          </h2>
          <p className="mt-1 text-caption text-ink-tertiary">
            Codes refresh every 30 seconds. We accept the current one and the one before it.
          </p>
          <Field className="mt-4">
            <FieldLabel>6-digit code</FieldLabel>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (codeError) setCodeError(null);
              }}
              placeholder="123 456"
              maxLength={9}
              className="font-mono tracking-widest"
              autoFocus
            />
            <FieldError>{codeError}</FieldError>
            <FieldHelpText>
              Stuck?{" "}
              <button
                type="button"
                onClick={() => setStep("scan")}
                className="rounded text-ink-secondary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Go back to the QR step
              </button>
            </FieldHelpText>
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep("scan")} disabled={busy}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={confirmCode}
              disabled={busy || code.replace(/\s+/g, "").length < 6}
            >
              {busy ? (
                <>
                  <Spinner size={16} /> Confirming…
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
