"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldLabel,
  FieldHelpText,
  FieldError,
  Input,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
} from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import {
  MessageSquare,
  Phone,
  ArrowUpRight,
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
  const [resolveOpen, setResolveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function acknowledge() {
    if (!topFlagId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/flags/${topFlagId}/acknowledge`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      if (res.ok) {
        toast.success("Flag acknowledged");
        router.refresh();
      } else {
        toast.error("Couldn't acknowledge — try again.");
      }
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
            <Button asChild variant="primary" className="w-full justify-start">
              <Link href={`/coordinator/messages/${existingThreadId}`}>
                <MessageSquare className="h-4 w-4" /> Send message
              </Link>
            </Button>
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
              onClick={() => setResolveOpen(true)}
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

      <LogContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        veteranId={veteranId}
        onSaved={() => router.refresh()}
      />
      <EscalateDialog
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        veteranId={veteranId}
        flagId={topFlagId}
        onSaved={() => router.refresh()}
      />
      <ResolveDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        flagId={topFlagId}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

const CONTACT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "OUTREACH_CALL", label: "Outreach call" },
  { value: "TEXT", label: "Text" },
  { value: "EMAIL", label: "Email" },
  { value: "IN_PERSON", label: "In person" },
  { value: "CHECK_IN_REVIEW", label: "Check-in review" },
  { value: "CRISIS", label: "Crisis" },
];

function LogContactDialog({
  open,
  onOpenChange,
  veteranId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veteranId: string;
  onSaved: () => void;
}) {
  const [type, setType] = useState("OUTREACH_CALL");
  const [direction, setDirection] = useState("OUTBOUND");
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [followUpBy, setFollowUpBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ summary?: string; followUpBy?: string }>({});

  function reset() {
    setType("OUTREACH_CALL");
    setDirection("OUTBOUND");
    setSummary("");
    setFollowUp(false);
    setFollowUpBy("");
    setErrors({});
  }

  async function save() {
    const nextErrors: typeof errors = {};
    if (!summary.trim()) nextErrors.summary = "A short summary helps the next coordinator.";
    if (followUp && !followUpBy) nextErrors.followUpBy = "When should we follow up?";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
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
        toast.error(j.error || "Couldn't save the contact.");
        return;
      }
      toast.success("Contact logged. Editable for 24h.");
      reset();
      onOpenChange(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a contact</DialogTitle>
          <DialogDescription>
            Encrypted at rest. Editable for 24 hours, then locked.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {CONTACT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel>Direction</FieldLabel>
            <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="OUTBOUND">Outbound</option>
              <option value="INBOUND">Inbound</option>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel>Summary</FieldLabel>
          <Textarea
            rows={5}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What did you cover? Anything to follow up on?"
          />
          <FieldError>{errors.summary}</FieldError>
          <FieldHelpText>
            What you write here is end-to-end encrypted. Stick to facts the next coordinator needs.
          </FieldHelpText>
        </Field>
        <Field>
          <Checkbox
            label="A follow-up is needed"
            checked={followUp}
            onChange={(e) => setFollowUp(e.target.checked)}
          />
        </Field>
        {followUp && (
          <Field>
            <FieldLabel>Follow up by</FieldLabel>
            <Input
              type="datetime-local"
              value={followUpBy}
              onChange={(e) => setFollowUpBy(e.target.value)}
            />
            <FieldError>{errors.followUpBy}</FieldError>
          </Field>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EscalateDialog({
  open,
  onOpenChange,
  veteranId,
  flagId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veteranId: string;
  flagId: string | null;
  onSaved: () => void;
}) {
  const [recommended, setRecommended] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
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
        toast.error(j.error || "Couldn't escalate.");
        return;
      }
      toast.success("Escalated. Clinical lead has been paged.");
      setRecommended("");
      onOpenChange(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalate to Clinical Lead</DialogTitle>
          <DialogDescription>
            The on-call clinical lead will be paged immediately via email and push.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel optional>Recommended action</FieldLabel>
          <Textarea
            rows={3}
            value={recommended}
            onChange={(e) => setRecommended(e.target.value)}
            placeholder="What would help the clinical lead jump in fast?"
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? "Escalating…" : "Escalate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RESOLVE_OPTIONS = [
  {
    value: "contacted" as const,
    label: "Contacted the veteran",
    description: "You reached them and the issue is addressed.",
  },
  {
    value: "escalated" as const,
    label: "Escalated to Clinical Lead",
    description: "Already paged the clinical lead — no further coordinator action needed.",
  },
  {
    value: "false_positive" as const,
    label: "False positive",
    description: "The signal was real but, in context, no outreach was needed.",
  },
  {
    value: "deferred" as const,
    label: "Deferred",
    description: "Not urgent — will revisit at the next check-in.",
  },
];

type ResolveOutcome = (typeof RESOLVE_OPTIONS)[number]["value"];

function ResolveDialog({
  open,
  onOpenChange,
  flagId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flagId: string | null;
  onSaved: () => void;
}) {
  const [outcome, setOutcome] = useState<ResolveOutcome | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!flagId || !outcome) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/flags/${flagId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ outcome, notes: notes.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Couldn't resolve the flag.");
        return;
      }
      toast.success("Flag resolved.");
      setOutcome(null);
      setNotes("");
      onOpenChange(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setOutcome(null);
          setNotes("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve flag</DialogTitle>
          <DialogDescription>
            Resolved flags drop off the queue. Pick what happened so the engine learns.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup<ResolveOutcome>
          name="resolve-outcome"
          options={RESOLVE_OPTIONS}
          value={outcome}
          onChange={setOutcome}
        />
        <Field>
          <FieldLabel optional>Notes</FieldLabel>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the next coordinator should know."
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !outcome}>
            {busy ? "Resolving…" : "Resolve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
