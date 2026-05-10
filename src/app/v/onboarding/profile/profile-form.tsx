"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export function ProfileForm({ initial, defaultTimezone }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
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
        setError(j.error || "Couldn't save");
        return;
      }
      router.push("/v");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset className="rounded-lg border border-border bg-canvas-card p-5">
        <legend className="px-1 text-caption font-semibold uppercase tracking-wide text-ink-tertiary">
          When to ask you
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-caption text-ink-secondary">Timezone</span>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              required
              className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
            />
          </label>
          <label className="block">
            <span className="text-caption text-ink-secondary">Day</span>
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
            >
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-caption text-ink-secondary">Local time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-border bg-canvas-card p-5">
        <legend className="px-1 text-caption font-semibold uppercase tracking-wide text-ink-tertiary">
          About your service
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-caption text-ink-secondary">Separation date</span>
            <input
              type="date"
              value={separationDate}
              onChange={(e) => setSeparationDate(e.target.value)}
              required
              className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
            />
          </label>
          <label className="block">
            <span className="text-caption text-ink-secondary">Branch</span>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
            >
              {BRANCHES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-caption text-ink-secondary">Years of service (optional)</span>
            <input
              type="number"
              min={0}
              max={50}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-border bg-canvas-card p-5">
        <legend className="px-1 text-caption font-semibold uppercase tracking-wide text-ink-tertiary">
          If we can't reach you
        </legend>
        <p className="mb-3 text-caption text-ink-tertiary">
          Optional. Only used if your coordinator can't reach you and they're worried.
          We'll never call without telling you first.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-caption text-ink-secondary">Name</span>
            <input
              type="text"
              value={ecName}
              onChange={(e) => setEcName(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
            />
          </label>
          <label className="block">
            <span className="text-caption text-ink-secondary">Phone</span>
            <input
              type="tel"
              value={ecPhone}
              onChange={(e) => setEcPhone(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
            />
          </label>
        </div>
        <label className="mt-3 inline-flex items-center gap-2 text-body text-ink-secondary">
          <input
            type="checkbox"
            checked={ecConsent}
            onChange={(e) => setEcConsent(e.target.checked)}
          />
          They've given permission for us to contact them in a crisis.
        </label>
      </fieldset>

      <fieldset className="rounded-lg border border-border bg-canvas-card p-5">
        <legend className="px-1 text-caption font-semibold uppercase tracking-wide text-ink-tertiary">
          Local VA (optional)
        </legend>
        <input
          type="text"
          placeholder="e.g. James A. Haley Veterans Hospital"
          value={vaFacility}
          onChange={(e) => setVaFacility(e.target.value)}
          className="h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body"
        />
      </fieldset>

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
        {submitting ? "Saving…" : "All set"}
      </button>
    </form>
  );
}
