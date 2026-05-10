"use client";

import { ThreadView, type ThreadMessage } from "@/components/sentinel/thread-view";
import { toast } from "@/components/ui/toast";

/**
 * Coordinator-side thread view. Wraps the shared ThreadView with AI-assist
 * enabled and the crisis-resource footer hidden (the staff app surfaces it
 * differently). The AI-assist handler calls the real /api/messages/draft
 * endpoint so the coordinator's intent + recent veteran context is fed in.
 */
export function CoordinatorThreadClient({
  threadId,
  currentUserId,
  initialMessages,
}: {
  threadId: string;
  currentUserId: string;
  initialMessages: ThreadMessage[];
}) {
  async function requestDraft(): Promise<string> {
    try {
      const res = await fetch("/api/messages/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          threadId,
          coordinatorIntent:
            "Acknowledge what they shared specifically. Offer one concrete next step. No pressure.",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.draft) {
        toast.error(j.error || "AI-assist isn't available right now.");
        return "";
      }
      return j.draft;
    } catch {
      toast.error("Network error reaching AI-assist.");
      return "";
    }
  }

  return (
    <ThreadView
      threadId={threadId}
      currentUserId={currentUserId}
      initialMessages={initialMessages}
      showDraftAssist
      onRequestDraft={requestDraft}
    />
  );
}
