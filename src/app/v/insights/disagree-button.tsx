"use client";

import { useState } from "react";

interface Props {
  checkInId: string;
}

export function DisagreeButton({ checkInId }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="mt-3 text-caption text-ink-tertiary">
        Thanks for adding context. Your coordinator can see it.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-caption text-ink-tertiary underline-offset-4 hover:underline"
      >
        This isn't the full picture
      </button>
    );
  }

  async function submit() {
    if (text.trim().length === 0) return;
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
      if (res.ok) setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Tell your coordinator what you'd want them to know."
        className="w-full rounded-md border border-border bg-canvas-card p-3 text-body text-ink-primary"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || text.trim().length === 0}
          className="h-9 rounded-md bg-primary px-4 text-body text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="h-9 px-3 text-body text-ink-tertiary hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
