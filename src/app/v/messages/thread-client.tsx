"use client";

import { ThreadView, type ThreadMessage } from "@/components/sentinel/thread-view";

/**
 * Veteran-side thread view. Wraps the shared ThreadView with the crisis
 * footer enabled and AI-assist disabled (veterans don't get an AI compose
 * button on their side).
 */
export function MessageThreadClient({
  threadId,
  currentUserId,
  initialMessages,
}: {
  threadId: string;
  currentUserId: string;
  initialMessages: ThreadMessage[];
}) {
  return (
    <ThreadView
      threadId={threadId}
      currentUserId={currentUserId}
      initialMessages={initialMessages}
      showCrisisFooter
    />
  );
}
