"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
      await fetch(`/api/escalations/${escalationId}/claim`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function transition(to: "ACTIONED" | "CLOSED") {
    if (!confirm(`Mark this escalation as ${to.toLowerCase()}?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/escalations/${escalationId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href={`/coordinator/veteran/${veteranId}`} className="inline-flex">
          <Button variant="primary">Open clinical view</Button>
        </Link>
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
      {notesOpen && (
        <NotesModal
          escalationId={escalationId}
          onClose={() => setNotesOpen(false)}
          onSaved={() => {
            setNotesOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function NotesModal({
  escalationId,
  onClose,
  onSaved,
}: {
  escalationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!notes.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/escalations/${escalationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
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
        <h2 className="text-body-lg font-semibold text-ink-primary">Add consult notes</h2>
        <p className="mt-1 text-caption text-ink-tertiary">Encrypted at rest.</p>
        <textarea
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-3 w-full rounded-md border border-border bg-canvas-card p-2 text-body"
        />
        {error && <p className="mt-2 text-body text-crisis">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !notes.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
