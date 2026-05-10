"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Flag as FlagIcon, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldHelpText,
  Input,
  Select,
  Checkbox,
} from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

interface InitialProfile {
  timezone: string;
  checkInDayOfWeek: number;
  checkInLocalTime: string;
  separationDate: Date;
  branchOfService: string;
  yearsOfService: number | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactConsent: boolean;
  localVAFacility: string | null;
}

interface Props {
  initial: InitialProfile | null;
  defaultTimezone: string;
}

const BRANCHES = ["Army", "Navy", "Air Force", "Marines", "Coast Guard", "Space Force", "National Guard"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STEPS = [
  { key: "cadence", label: "When to ask", icon: Clock },
  { key: "service", label: "Your service", icon: FlagIcon },
  { key: "contact", label: "If we can't reach you", icon: Phone },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function ProfileForm({ initial, defaultTimezone }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<StepKey>("cadence");

  const [timezone, setTimezone] = useState(initial?.timezone || defaultTimezone);
  const [day, setDay] = useState<number>(initial?.checkInDayOfWeek ?? 0);
  const [time, setTime] = useState(initial?.checkInLocalTime || "18:00");
  const [separationDate, setSeparationDate] = useState(
    initial?.separationDate ? initial.separationDate.toISOString().slice(0, 10) : "",
  );
  const [branch, setBranch] = useState(initial?.branchOfService || "Army");
  const [years, setYears] = useState<string>(initial?.yearsOfService?.toString() ?? "");
  const [ecName, setEcName] = useState(initial?.emergencyContactName ?? "");
  const [ecPhone, setEcPhone] = useState(initial?.emergencyContactPhone ?? "");
  const [ecConsent, setEcConsent] = useState(!!initial?.emergencyContactConsent);
  const [vaFacility, setVaFacility] = useState(initial?.localVAFacility ?? "");

  const [errors, setErrors] = useState<{ separationDate?: string; timezone?: string }>({});

  function validateStep(s: StepKey): boolean {
    const e: typeof errors = {};
    if (s === "cadence") {
      if (!timezone) e.timezone = "Set your timezone so we ask at the right hour.";
    }
    if (s === "service") {
      if (!separationDate) e.separationDate = "Pick the date you separated from service.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    if (step === "cadence") setStep("service");
    else if (step === "service") setStep("contact");
  }

  function prev() {
    if (step === "service") setStep("cadence");
    else if (step === "contact") setStep("service");
  }

  async function submit() {
    if (!validateStep("cadence") || !validateStep("service")) {
      setStep("cadence");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          timezone,
          checkInDayOfWeek: day,
          checkInLocalTime: time,
          separationDate,
          branchOfService: branch,
          yearsOfService: years ? Number(years) : undefined,
          emergencyContactName: ecName.trim() || undefined,
          emergencyContactPhone: ecPhone.trim() || undefined,
          emergencyContactConsent: ecConsent,
          localVAFacility: vaFacility.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Couldn't save");
        return;
      }
      toast.success("All set. Welcome.");
      router.push("/v");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} current={step} />

      {step === "cadence" && (
        <section className="space-y-3 rounded-lg border border-border bg-canvas-card p-5">
          <p className="text-caption text-ink-tertiary">
            We'll send your weekly check-in at this local time.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel>Timezone</FieldLabel>
              <Input
                type="text"
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  if (errors.timezone) setErrors((er) => ({ ...er, timezone: undefined }));
                }}
                required
              />
              <FieldError>{errors.timezone}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Day</FieldLabel>
              <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel>Local time</FieldLabel>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </Field>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={next} variant="primary">
              Next
            </Button>
          </div>
        </section>
      )}

      {step === "service" && (
        <section className="space-y-3 rounded-lg border border-border bg-canvas-card p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel>Separation date</FieldLabel>
              <Input
                type="date"
                value={separationDate}
                onChange={(e) => {
                  setSeparationDate(e.target.value);
                  if (errors.separationDate)
                    setErrors((er) => ({ ...er, separationDate: undefined }));
                }}
                required
              />
              <FieldError>{errors.separationDate}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Branch</FieldLabel>
              <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
                {BRANCHES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel optional>Years of service</FieldLabel>
              <Input
                type="number"
                min={0}
                max={50}
                value={years}
                onChange={(e) => setYears(e.target.value)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel optional>Local VA facility</FieldLabel>
            <Input
              type="text"
              placeholder="e.g. James A. Haley Veterans Hospital"
              value={vaFacility}
              onChange={(e) => setVaFacility(e.target.value)}
            />
            <FieldHelpText>If you have a regular VA, we'll surface it for your coordinator.</FieldHelpText>
          </Field>
          <div className="flex justify-between pt-2">
            <Button onClick={prev} variant="ghost">
              Back
            </Button>
            <Button onClick={next} variant="primary">
              Next
            </Button>
          </div>
        </section>
      )}

      {step === "contact" && (
        <section className="space-y-3 rounded-lg border border-border bg-canvas-card p-5">
          <p className="text-caption text-ink-tertiary">
            Optional. Only used if your coordinator can't reach you and they're worried.
            We'll never call without telling you first.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel optional>Name</FieldLabel>
              <Input
                type="text"
                value={ecName}
                onChange={(e) => setEcName(e.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field>
              <FieldLabel optional>Phone</FieldLabel>
              <Input
                type="tel"
                value={ecPhone}
                onChange={(e) => setEcPhone(e.target.value)}
                autoComplete="tel"
              />
            </Field>
          </div>
          <Field>
            <Checkbox
              label="They've given permission for us to contact them in a crisis."
              checked={ecConsent}
              onChange={(e) => setEcConsent(e.target.checked)}
            />
          </Field>
          <div className="flex justify-between pt-2">
            <Button onClick={prev} variant="ghost">
              Back
            </Button>
            <Button onClick={submit} variant="primary" disabled={submitting}>
              {submitting ? "Saving…" : "All set"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stepper({
  steps,
  current,
}: {
  steps: typeof STEPS;
  current: StepKey;
}) {
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2" aria-label="Onboarding progress">
      {steps.map((s, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={[
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-caption font-semibold transition-colors",
                isPast
                  ? "bg-primary text-primary-foreground"
                  : isCurrent
                  ? "bg-primary/10 text-primary ring-2 ring-primary/40"
                  : "bg-canvas-banded text-ink-tertiary",
              ].join(" ")}
            >
              {i + 1}
            </span>
            <span
              className={[
                "truncate text-caption",
                isCurrent
                  ? "font-semibold text-ink-primary"
                  : isPast
                  ? "text-ink-secondary"
                  : "text-ink-tertiary",
              ].join(" ")}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="ml-1 hidden h-px flex-1 bg-border sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
