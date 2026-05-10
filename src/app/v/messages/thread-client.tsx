"use client";

import * as React from "react";
import { Phone } from "lucide-react";
import { MessageBubble } from "@/components/sentinel/message-bubble";
import { MessageComposer } from "@/components/sentinel/message-composer";
import { toast } from "@/components/ui/toast";

interface SerializedMsg {
  id: string;
  body: string;
  sentAt: string;
  fromSelf: boolean;
  read: boolean;
}

interface DisplayMsg {
  id: string;
  body: string;
  sentAt: Date;
  fromSelf: boolean;
  read: boolean;
  pending?: boolean;
  failed?: boolean;
}

/**
 * Veteran-side thread renderer + composer.
 *
 * Optimistic send: the message appears in the thread immediately with a
 * `pending` flag. On success the row is replaced with the server's id +
 * timestamp; on failure we surface a toast and mark the row failed so the
 * user can retry.
 *
 * Auto-scrolls to the bottom on mount and on each new message.
 */
export function MessageThreadClient({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: SerializedMsg[];
}) {
  const [messages, setMessages] = React.useState<DisplayMsg[]>(() =>
    initialMessages.map((m) => ({ ...m, sentAt: new Date(m.sentAt) })),
  );
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(body: string) {
    const tempId = `local-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        body,
        sentAt: new Date(),
        fromSelf: true,
        read: false,
        pending: true,
      },
    ]);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": tempId,
        },
        body: JSON.stringify({ threadId, body }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(j.error || "Couldn't send — try again.");
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
        );
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: j.messageId ?? m.id,
                pending: false,
                failed: false,
                sentAt: j.sentAt ? new Date(j.sentAt) : m.sentAt,
              }
            : m,
        ),
      );
    } catch {
      toast.error("Network error.");
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
      );
    }
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 && (
          <p className="rounded-md border border-border bg-canvas-banded p-4 text-body text-ink-secondary">
            No messages yet. Say hi when you're ready.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id}>
            <MessageBubble
              body={m.body}
              sentAt={m.sentAt}
              fromSelf={m.fromSelf}
              read={m.read}
            />
            {m.pending && (
              <p className="mt-1 text-right text-[0.6875rem] text-ink-tertiary">Sending…</p>
            )}
            {m.failed && (
              <p className="mt-1 text-right text-[0.6875rem] font-semibold text-crisis">
                Couldn't send
              </p>
            )}
          </div>
        ))}
        <a
          href="tel:988"
          className="block rounded-md border border-crisis/30 bg-crisis/5 px-3 py-2 text-caption text-ink-secondary"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold text-crisis">
            <Phone className="h-3.5 w-3.5" aria-hidden /> 988, press 1
          </span>{" "}
          — for anything your coordinator can't get to in time.
        </a>
      </div>
      <MessageComposer
        threadId={threadId}
        onSend={async (body: string) => {
          await send(body);
        }}
      />
    </>
  );
}
