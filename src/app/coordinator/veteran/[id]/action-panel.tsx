"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Phone,
  ArrowUpRight,
  Sparkles,
  Check,
  CheckCircle2,
} from "lucide-react";
import type { RiskLevel } from "@/lib/risk/types";

interface Props {
  veteranId: string;
  riskLevel: RiskLevel;
  actionLabel: string;
  actionDeadline: string;
  topFlagId: string | null;
  topFlagAcknowledged: boolean;
  existingThreadId: string | null;
}

const accentByLevel: Record<RiskLevel, string> = {
  RED: "text-risk-red",
  ORANGE: "text-risk-orange",
  YELLOW: "text-risk-yellow",
  GREEN: "text-ink-secondary",
};

export function ActionPanel({
  veteranId,
  riskLevel,
  actionLabel,
  actionDeadline,
  topFlagId,
  topFlagAcknowledged,
  existingThreadId,
}: Props) {
  const router = useRouter();
  const [contactOpen, setContactOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function acknowledge() {
    if (!topFlagId) return;
    setBusy(true);
    try {
      await fetch(`/api/flags/${topFlagId}/acknowledge`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    if (!topFlagId) return;
    const outcome = prompt("Resolve outcome (contacted | escalated | false_positive | deferred):", "contacted");
    if (!outcome) return;
    setBusy(true);
    try {
      await fetch(`/api/flags/${topFlagId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ outcome }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-body-lg">Recommended action</CardTitle>
          <CardDescription>
            {actionLabel}. Contact within{" "}
            <strong className={accentByLevel[riskLevel]}>{actionDeadline}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {existingThreadId ? (
            <Link href={`/coordinator/messages/${existingThreadId}`} className="block">
              <Button variant="primary" className="w-full justify-start">
                <MessageSquare className="h-4 w-4" /> Send message
              </Button>
            </Link>
          ) : (
            <Button
              variant="primary"
              className="w-full justify-start"
              onClick={() => router.push("/coordinator/messages")}
            >
              <MessageSquare className="h-4 w-4" /> Send message
            </Button>
          )}
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => setContactOpen(true)}
          >
            <Phone className="h-4 w-4" /> Log a contact
          </Button>
          <Separator />
          {topFlagId && !topFlagAcknowledged && (
            <Button
              variant="ghost"
              className="w-full justify-start text-ink-secondary"
              onClick={acknowledge}
              disabled={busy}
            >
              <Check className="h-4 w-4" /> Acknowledge flag
            </Button>
          )}
          {topFlagId && (
            <Button
              variant="ghost"
              className="w-full justify-start text-ink-secondary"
              onClick={resolve}
              disabled={busy}
            >
              <CheckCircle2 className="h-4 w-4" /> Resolve flag
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-ink-secondary"
            onClick={() => setEscalateOpen(true)}
            disabled={busy}
          >
            <ArrowUpRight className="h-4 w-4" /> Escalate to Clinical Lead
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body-lg">Triage protocol · {riskLevel}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-body text-ink-secondary">
            <li>· Review the last 4 weeks before reaching out.</li>
            <li>· Acknowledge what they shared specifically.</li>
            <li>· Offer one concrete next step. No pressure.</li>
            <li>· Log the contact within 24 hours of completion.</li>
            <li>· Consult Clinical Lead if uncertain.</li>
          </ul>
        </CardContent>
      </Card>

      {contactOpen && (
        <LogContactModal
          veteranId={veteranId}
          onClose={() => setContactOpen(false)}
          onSaved={() => {
            setContactOpen(false);
            router.refresh();
          }}
        />
      )}
      {escalateOpen && (
        <EscalateModal
          veteranId={veteranId}
          flagId={topFlagId}
          onClose={() => setEscalateOpen(false)}
          onSaved={() => {
            setEscalateOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function LogContactModal({
  veteranId,
  onClose,
  onSaved,
}: {
  veteranId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState("OUTREACH_CALL");
  const [direction, setDirection] = useState("OUTBOUND");
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [followUpBy, setFollowUpBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          veteranId,
          contactType: type,
          direction,
          summary,
          followUpRequired: followUp,
          followUpBy: followUp && followUpBy ? new Date(followUpBy).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Couldn't save");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-canvas-card p-5 shadow-soft">
        <h2 className="text-body-lg font-semibold text-ink-primary">Log a contact</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-caption text-ink-secondary">Type</span>
            <select className="mt-1 h-10 w-full rounded-md border border-border bg-canvas-card px-2 text-body" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="OUTREACH_CALL">Outreach call</option>
              <option value="TEXT">Text</option>
              <option value="EMAIL">Email</option>
              <option value="IN_PERSON">In person</option>
              <option value="CHECK_IN_REVIEW">Check-in review</option>
              <option value="CRISIS">Crisis</option>
            </select>
          </label>
          <label className="block">
            <span className="text-caption text-ink-secondary">Direction</span>
            <select className="mt-1 h-10 w-full rounded-md border border-border bg-canvas-card px-2 text-body" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="OUTBOUND">Outbound</option>
              <option value="INBOUND">Inbound</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <span className="text-caption text-ink-secondary">Summary</span>
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-canvas-card p-2 text-body"
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <label className="mt-3 inline-flex items-center gap-2 text-body text-ink-secondary">
          <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
          Follow-up required
        </label>
        {followUp && (
          <input type="datetime-local" value={followUpBy} onChange={(e) => setFollowUpBy(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-canvas-card px-2 text-body" />
        )}
        {error && <p className="mt-2 text-body text-crisis">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || !summary.trim()}>Save</Button>
        </div>
      </div>
    </div>
  );
}

function EscalateModal({
  veteranId,
  flagId,
  onClose,
  onSaved,
}: {
  veteranId: string;
  flagId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [recommended, setRecommended] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/escalations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          veteranId,
          triggeredByFlagId: flagId ?? undefined,
          recommendedAction: recommended || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Couldn't escalate");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-canvas-card p-5 shadow-soft">
        <h2 className="text-body-lg font-semibold text-ink-primary">Escalate to Clinical Lead</h2>
        <p className="mt-1 text-caption text-ink-tertiary">
          The on-call clinical lead will be paged immediately.
        </p>
        <label className="mt-3 block">
          <span className="text-caption text-ink-secondary">Recommended action (optional)</span>
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-canvas-card p-2 text-body"
            rows={3}
            value={recommended}
            onChange={(e) => setRecommended(e.target.value)}
          />
        </label>
        {error && <p className="mt-2 text-body text-crisis">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>Escalate</Button>
        </div>
      </div>
    </div>
  );
}
