"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

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
        className="mt-3 rounded text-caption text-ink-tertiary underline-offset-4 hover:text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      if (res.ok) {
        toast.success("Sent. Your coordinator will see this before next outreach.");
        setDone(true);
      } else {
        toast.error("Couldn't send — please try again.");
      }
    } finally {
      setSubmitting(false);
    }
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
          onClick={submit}
          disabled={submitting || text.trim().length === 0}
        >
          {submitting ? "Sending…" : "Send"}
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
