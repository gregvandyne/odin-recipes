"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "@/components/sentinel/message-bubble";
import { MessageComposer } from "@/components/sentinel/message-composer";
import { Phone } from "lucide-react";

/**
 * Veteran messaging surface — single thread with assigned coordinator.
 *
 * Crisis resources are visible at all times. Response time expectations are
 * surfaced (set during onboarding). No typing indicators. Read receipts only.
 */
interface Msg {
  id: string;
  body: string;
  sentAt: Date;
  fromSelf: boolean;
  read?: boolean;
}

const initialMessages: Msg[] = [
  { id: "m1", body: "Hi Jordan — saw your check-in. The job thing falling through sounds rough. Want to talk this week?", sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000), fromSelf: false },
  { id: "m2", body: "Yeah. Thursday afternoon would work.", sentAt: new Date(Date.now() - 90 * 60 * 1000), fromSelf: true, read: true },
  { id: "m3", body: "Thursday 2pm? I'll send a calendar invite.", sentAt: new Date(Date.now() - 75 * 60 * 1000), fromSelf: false },
];

export default function VeteranMessages() {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);

  async function send(body: string) {
    setMessages((m) => [
      ...m,
      { id: `local-${Date.now()}`, body, sentAt: new Date(), fromSelf: true, read: false },
    ]);
    // POST to /api/messages here in production
  }

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100vh-8rem)] flex-col">
      <header className="border-b border-border bg-canvas-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar initials="SK" size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-body font-semibold text-ink-primary">Sam Kim</div>
            <div className="flex items-center gap-1.5 text-caption text-ink-tertiary">
              <span className="h-1.5 w-1.5 rounded-full bg-risk-green" />
              Usually replies within 4 hours
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} body={m.body} sentAt={m.sentAt} fromSelf={m.fromSelf} read={m.read} />
        ))}
        <a
          href="tel:988"
          className="block rounded-md border border-crisis/30 bg-crisis/5 px-3 py-2 text-caption text-ink-secondary"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold text-crisis">
            <Phone className="h-3.5 w-3.5" /> 988, press 1
          </span>{" "}
          — for anything Sam can't get to in time.
        </a>
      </div>

      <MessageComposer threadId="thread-1" onSend={send} />
    </div>
  );
}
