"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel, Textarea } from "@/components/ui/field";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";

interface Props {
  escalationId: string;
  status: "PENDING" | "IN_REVIEW" | "ACTIONED" | "CLOSED";
  isMine: boolean;
  veteranId: string;
}

export function ClinicalActions({ escalationId, status, isMine, veteranId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // Live-refresh on incoming SSE events for this clinical lead.
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/clinical/escalations/stream");
      es.addEventListener("escalation.created", () => router.refresh());
      es.addEventListener("escalation.transitioned", () => router.refresh());
      es.onerror = () => {
        es?.close();
        es = null;
      };
    } catch {
      /* noop */
    }
    return () => {
      es?.close();
    };
  }, [router]);

  async function claim() {
    setBusy(true);
    try {
      const res = await fetch(`/api/escalations/${escalationId}/claim`, { method: "POST" });
      if (res.ok) {
        toast.success("You've taken this case.");
        router.refresh();
      } else if (res.status === 409) {
        toast.message("Another clinician already claimed this one.");
        router.refresh();
      } else {
        toast.error("Couldn't claim — try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function transition(to: "ACTIONED" | "CLOSED") {
    const ok = await confirm({
      title: to === "CLOSED" ? "Close this escalation?" : "Mark this escalation as actioned?",
      body:
        to === "CLOSED"
          ? "Closing removes it from the active queue. The audit trail stays."
          : "Actioned means clinical guidance has been delivered. The case will stay until closed.",
      confirmLabel: to === "CLOSED" ? "Close" : "Mark actioned",
      tone: to === "CLOSED" ? "destructive" : "primary",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/escalations/${escalationId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      if (res.ok) {
        toast.success(to === "CLOSED" ? "Escalation closed." : "Marked actioned.");
        router.refresh();
      } else {
        toast.error("Couldn't update — try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="primary">
          <Link href={`/coordinator/veteran/${veteranId}`}>Open clinical view</Link>
        </Button>
        {!isMine && status === "PENDING" && (
          <Button variant="secondary" onClick={claim} disabled={busy}>
            Take it
          </Button>
        )}
        {isMine && (
          <>
            <Button variant="secondary" onClick={() => setNotesOpen(true)}>
              Add consult notes
            </Button>
            {status !== "ACTIONED" && (
              <Button variant="secondary" onClick={() => transition("ACTIONED")} disabled={busy}>
                Mark actioned
              </Button>
            )}
            {status !== "CLOSED" && (
              <Button variant="ghost" onClick={() => transition("CLOSED")} disabled={busy}>
                Close
              </Button>
            )}
          </>
        )}
      </div>
      <NotesDialog
        open={notesOpen}
        onOpenChange={setNotesOpen}
        escalationId={escalationId}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

function NotesDialog({
  open,
  onOpenChange,
  escalationId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  escalationId: string;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!notes.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/escalations/${escalationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Couldn't save notes.");
        return;
      }
      toast.success("Notes saved (encrypted).");
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
        if (!o) setNotes("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add consult notes</DialogTitle>
          <DialogDescription>Encrypted at rest. Append-only — to amend, post a new note.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Notes</FieldLabel>
          <Textarea
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Clinical context, recommended action, follow-up plan."
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !notes.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
