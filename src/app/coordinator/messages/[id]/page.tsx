"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RiskBadge } from "@/components/sentinel/risk-badge";
import { MessageBubble } from "@/components/sentinel/message-bubble";
import { MessageComposer } from "@/components/sentinel/message-composer";
import { ChevronLeft, Sparkles, Info } from "lucide-react";
import Link from "next/link";

interface Msg { id: string; body: string; sentAt: Date; fromSelf: boolean; read?: boolean; aiAssisted?: boolean }

const initial: Msg[] = [
  { id: "m1", body: "Hi Jordan — saw your check-in. The job thing falling through sounds rough. Want to talk this week?", sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000), fromSelf: true, read: true, aiAssisted: false },
  { id: "m2", body: "Yeah. Thursday afternoon would work.", sentAt: new Date(Date.now() - 90 * 60 * 1000), fromSelf: false },
  { id: "m3", body: "Thursday 2pm? I'll send a calendar invite.", sentAt: new Date(Date.now() - 75 * 60 * 1000), fromSelf: true, read: true },
];

export default function CoordinatorThread({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<Msg[]>(initial);

  async function send(body: string, aiAssisted: boolean) {
    setMessages((m) => [...m, { id: `s-${Date.now()}`, body, sentAt: new Date(), fromSelf: true, read: false, aiAssisted }]);
  }

  async function requestDraft(): Promise<string> {
    // POST /api/messages/draft in production. The server pulls recent context,
    // calls Claude, returns the draft. The coordinator reviews before sending.
    return "Glad Thursday works. I blocked 2:00 — does the VA campus or video work better for you?";
  }

  return (
    <div className="grid h-[calc(100vh-3rem)] grid-cols-12">
      {/* Thread (col-span-8) */}
      <div className="col-span-12 flex flex-col border-r border-border lg:col-span-8">
        <header className="flex items-center gap-3 border-b border-border bg-canvas-card px-4 py-3">
          <Link href="/coordinator/messages" className="text-ink-tertiary hover:text-ink-primary">
            <ChevronLeft className="h-4 w-4" aria-label="Back" />
          </Link>
          <Avatar initials="JR" size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href="/coordinator/veteran/demo-2" className="text-body font-semibold text-ink-primary hover:underline">PO2 J. Reed</Link>
              <Badge variant="outline">Wk 9</Badge>
              <RiskBadge level="ORANGE" size="sm" />
            </div>
            <div className="text-caption text-ink-tertiary">Last check-in 3 days ago · Sleep + Mood + Connection compounding</div>
          </div>
          <Button variant="ghost" size="sm">View timeline</Button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} {...m} />
          ))}
        </div>

        <MessageComposer threadId={params.id} showDraftAssist onSend={send} onRequestDraft={requestDraft} />
      </div>

      {/* Context drawer (col-span-4) */}
      <aside className="col-span-12 hidden flex-col gap-3 border-l border-border bg-canvas-staff p-4 lg:col-span-4 lg:flex">
        <div>
          <p className="text-caption uppercase tracking-wide text-ink-tertiary">Context</p>
          <h2 className="mt-1 text-body-lg font-semibold text-ink-primary">Last 4 weeks</h2>
        </div>

        <div className="rounded-md border border-border bg-canvas-card p-3 text-body text-ink-secondary">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-tertiary" aria-hidden />
            <p>
              Open-ended week 8: <em>"Haven't slept right in two weeks. The job thing fell through."</em>
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-canvas-card p-3">
          <p className="text-caption uppercase tracking-wide text-ink-tertiary">Recommended</p>
          <ul className="mt-2 space-y-1.5 text-body text-ink-secondary">
            <li>· Acknowledge the job loss directly.</li>
            <li>· Offer a concrete next step (a call, a meeting).</li>
            <li>· Mention VA financial counseling if open.</li>
            <li>· No pressure on timeline.</li>
          </ul>
        </div>

        <Separator />

        <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
          <p className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary">
            <Sparkles className="h-3 w-3" /> AI-assist available
          </p>
          <p className="mt-1 text-caption text-ink-secondary">
            Click the sparkle next to send to generate a draft based on the last 4 weeks. Always review before sending.
          </p>
        </div>
      </aside>
    </div>
  );
}
