"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

/**
 * "This isn't the full picture" — veteran-side disagree affordance.
 *
 * The submission is debounced by a 5-second optimistic-undo window so a
 * veteran who hits send and immediately changes their mind can pull it
 * back. Only after the window elapses do we POST to the feedback endpoint.
 */
const UNDO_WINDOW_MS = 5_000;

interface Props {
  checkInId: string;
}

export function DisagreeButton({ checkInId }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  if (done) {
    return (
      <p className="mt-3 text-caption text-ink-tertiary">
        Thanks for adding context. Your coordinator can see it.
      </p>
    );
  }

  if (!open && !pending) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded text-caption text-ink-tertiary underline-offset-4 hover:text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        This isn't the full picture
      </button>
    );
  }

  if (pending) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-canvas-banded p-3 text-caption text-ink-secondary sm:flex-row sm:items-center sm:justify-between"
      >
        <span>Sending your context to your coordinator…</span>
        <button
          type="button"
          onClick={() => {
            if (undoTimer.current) clearTimeout(undoTimer.current);
            setPending(null);
            setOpen(true);
            toast.message("Cancelled. Edit and try again.");
          }}
          className="self-start rounded font-semibold text-ink-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto"
        >
          Undo
        </button>
      </div>
    );
  }

  function send() {
    if (text.trim().length === 0) return;
    setPending(text);
    setOpen(false);
    undoTimer.current = setTimeout(async () => {
      undoTimer.current = null;
      setSubmitting(true);
      try {
        const res = await fetch(`/api/check-ins/${checkInId}/feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ body: text }),
        });
        if (res.ok) {
          toast.success("Sent. Your coordinator will see this before next outreach.");
          setDone(true);
        } else {
          toast.error("Couldn't send — please try again.");
          setOpen(true);
        }
      } finally {
        setSubmitting(false);
        setPending(null);
      }
    }, UNDO_WINDOW_MS);
  }

  return (
    <div className="mt-3 space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Tell your coordinator what you'd want them to know."
      />
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={send}
          disabled={submitting || text.trim().length === 0}
        >
          {submitting ? (
            <>
              <Spinner size={14} /> Sending…
            </>
          ) : (
            "Send"
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
