"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { MessageBubble } from "@/components/sentinel/message-bubble";
import { MessageComposer } from "@/components/sentinel/message-composer";
import { toast } from "@/components/ui/toast";

/**
 * Shared thread renderer for both veteran and coordinator surfaces.
 *
 * Responsibilities:
 *   - Render the message list with optimistic-send and read receipts.
 *   - Subscribe to /api/messages/threads/[id]/stream (SSE) and prepend
 *     incoming messages without a full reload.
 *   - Mark unread incoming messages as read on first paint and again when
 *     the tab regains focus.
 *   - Auto-scroll to the bottom on mount and on each new message.
 *
 * The veteran surface passes `showCrisisFooter` so the 988 link is
 * rendered above the composer. The coordinator surface uses
 * `showDraftAssist` to expose AI-assist on the composer.
 */

export interface ThreadMessage {
  id: string;
  body: string;
  sentAt: string;
  fromSelf: boolean;
  read: boolean;
  aiAssisted?: boolean;
}

interface DisplayMsg extends Omit<ThreadMessage, "sentAt"> {
  sentAt: Date;
  pending?: boolean;
  failed?: boolean;
}

interface Props {
  threadId: string;
  initialMessages: ThreadMessage[];
  /**
   * Current viewer's user id. Used to skip the SSE-triggered router.refresh
   * for events that originated from this same user — those events arrive on
   * the per-thread channel because we publish to every participant, but the
   * sender's optimistic UI already shows the message locally.
   */
  currentUserId: string;
  showDraftAssist?: boolean;
  showCrisisFooter?: boolean;
  onRequestDraft?: () => Promise<string>;
}

export function ThreadView({
  threadId,
  initialMessages,
  currentUserId,
  showDraftAssist,
  showCrisisFooter,
  onRequestDraft,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<DisplayMsg[]>(() =>
    initialMessages.map((m) => ({ ...m, sentAt: new Date(m.sentAt) })),
  );
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const lastIdRef = React.useRef<string | null>(initialMessages.at(-1)?.id ?? null);

  // Auto-scroll on new messages.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Mark unread on mount + on focus return.
  React.useEffect(() => {
    let cancelled = false;
    async function markRead() {
      try {
        await fetch(`/api/messages/threads/${threadId}/read`, { method: "POST" });
      } catch {
        /* swallow */
      }
      if (!cancelled) {
        setMessages((prev) => prev.map((m) => (m.fromSelf ? m : { ...m, read: true })));
      }
    }
    void markRead();
    const onFocus = () => void markRead();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [threadId]);

  // SSE subscription for live message delivery.
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/messages/threads/${threadId}/stream`);
      es.addEventListener("message.created", (e) => {
        // Skip self-originated events. The server publishes to every thread
        // participant; the sender's optimistic UI already rendered the
        // bubble, and a refresh would only cause a visible re-render churn.
        try {
          const data = JSON.parse((e as MessageEvent).data) as {
            payload?: { senderId?: string };
          };
          if (data?.payload?.senderId && data.payload.senderId === currentUserId) {
            return;
          }
        } catch {
          /* fall through and refresh — better to over-refresh than miss */
        }
        // Refresh so the server component re-renders and the client component
        // receives fresh `initialMessages`. We don't fetch the body separately
        // because that would skip the AAD-bound decryption that already
        // happens server-side in tenant context.
        router.refresh();
      });
      es.onerror = () => {
        es?.close();
        es = null;
      };
    } catch {
      /* SSE not available — page will still update on next nav. */
    }
    return () => {
      es?.close();
    };
  }, [threadId, router, currentUserId]);

  // Re-derive from initialMessages when it changes (after router.refresh).
  React.useEffect(() => {
    const last = initialMessages.at(-1);
    if (!last) return;
    if (last.id === lastIdRef.current) return;
    lastIdRef.current = last.id;
    setMessages(initialMessages.map((m) => ({ ...m, sentAt: new Date(m.sentAt) })));
  }, [initialMessages]);

  async function send(body: string, aiAssisted: boolean) {
    const tempId = `local-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        body,
        sentAt: new Date(),
        fromSelf: true,
        read: false,
        aiAssisted,
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
        body: JSON.stringify({ threadId, body, aiAssistedDraft: aiAssisted || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(j.error === "thread archived" ? "This thread is archived." : (j.error || "Couldn't send — try again."));
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
      toast.error("Network error. We'll retry when you're back online.");
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
              aiAssisted={m.aiAssisted}
            />
            {m.pending && (
              <p className="mt-1 text-right text-[0.6875rem] text-ink-tertiary">Sending…</p>
            )}
            {m.failed && (
              <p className="mt-1 text-right text-[0.6875rem] font-semibold text-crisis">
                Couldn't send · tap to retry
              </p>
            )}
          </div>
        ))}
        {showCrisisFooter && (
          <a
            href="tel:988"
            className="block rounded-md border border-crisis/30 bg-crisis/5 px-3 py-2 text-caption text-ink-secondary"
          >
            <span className="inline-flex items-center gap-1.5 font-semibold text-crisis">
              <Phone className="h-3.5 w-3.5" aria-hidden /> 988, press 1
            </span>{" "}
            — for anything your coordinator can't get to in time.
          </a>
        )}
      </div>
      <MessageComposer
        threadId={threadId}
        showDraftAssist={showDraftAssist}
        onRequestDraft={onRequestDraft}
        onSend={send}
      />
    </>
  );
}
