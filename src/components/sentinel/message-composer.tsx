"use client";

import { useState, useTransition } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  threadId: string;
  /** True for coordinators — exposes the AI-draft action. */
  showDraftAssist?: boolean;
  onSend: (body: string, aiAssisted: boolean) => Promise<void>;
  onRequestDraft?: () => Promise<string>;
}

export function MessageComposer({ threadId, showDraftAssist, onSend, onRequestDraft }: Props) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [draftLabel, setDraftLabel] = useState<"AI-assisted draft" | null>(null);

  function send() {
    const text = body.trim();
    if (!text || pending) return;
    startTransition(async () => {
      await onSend(text, draftLabel !== null);
      setBody("");
      setDraftLabel(null);
    });
  }

  async function requestDraft() {
    if (!onRequestDraft || pending) return;
    const draft = await onRequestDraft();
    setBody(draft);
    setDraftLabel("AI-assisted draft");
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); send(); }}
      className="border-t border-border bg-canvas-card p-3"
    >
      {draftLabel && (
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-caption text-primary">
          <Sparkles className="h-3 w-3" aria-hidden /> {draftLabel} · review before sending
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor={`composer-${threadId}`}>Message</label>
        <textarea
          id={`composer-${threadId}`}
          value={body}
          onChange={(e) => { setBody(e.target.value); setDraftLabel(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message…"
          rows={2}
          className="min-h-[44px] flex-1 resize-none rounded-md border border-border bg-canvas-card px-3 py-2 text-body text-ink-primary placeholder:text-ink-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-col gap-2">
          {showDraftAssist && onRequestDraft && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={requestDraft}
              disabled={pending}
              aria-label="Generate AI-assisted draft"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          )}
          <Button type="submit" size="icon" disabled={pending || body.trim().length === 0} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-caption text-ink-tertiary">⌘+Enter to send</p>
    </form>
  );
}
