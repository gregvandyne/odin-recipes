"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Consent capture. Versioned. Specific. Plain language. Each item is
 * its own decision — no "agree to all" page.
 */
const CONSENT_VERSION = "1.0.0";

const ITEMS = [
  {
    id: "weekly-checkin",
    title: "Weekly check-ins",
    body:
      "I agree to receive a weekly invitation to answer six short questions. I can skip any question. I can stop the program at any time.",
  },
  {
    id: "ai-analysis",
    title: "AI analysis (no replies, no diagnosis)",
    body:
      "I understand that an AI tool reads my open-ended responses to look for language patterns that may warrant a human follow-up. The AI never replies to me. The AI does not diagnose. A trained Coordinator decides what to do.",
  },
  {
    id: "human-outreach",
    title: "Human outreach when patterns shift",
    body:
      "If something in my answers shifts in a way the system flags, my Coordinator may reach out. They will use the messaging in this app, or email or phone if I've allowed those.",
  },
  {
    id: "data-use",
    title: "Data use",
    body:
      "My data is used to support me. It is not sold. It is not shared outside this program except in the documented cases (clinical safety, my explicit request, or legal requirement).",
  },
];

export default function ConsentPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const allAccepted = ITEMS.every((i) => accepted[i.id]);

  function toggle(id: string) {
    setAccepted((s) => ({ ...s, [id]: !s[id] }));
  }

  async function submit() {
    await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consentVersion: CONSENT_VERSION }),
    });
    router.push("/v");
  }

  return (
    <div className="space-y-6">
      <p className="text-caption text-ink-tertiary">Step 7 of 7 · Consent v{CONSENT_VERSION}</p>
      <h1 className="text-display font-semibold text-ink-primary">Just a few specifics.</h1>
      <p className="text-body-lg text-ink-secondary">
        Each item is its own choice. Read them at your pace.
      </p>

      <div className="space-y-3">
        {ITEMS.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer gap-3 rounded-lg border border-border bg-canvas-card p-4"
          >
            <input
              type="checkbox"
              checked={!!accepted[item.id]}
              onChange={() => toggle(item.id)}
              className="mt-1 h-5 w-5 shrink-0 accent-primary"
            />
            <div>
              <h2 className="text-body-lg font-semibold text-ink-primary">{item.title}</h2>
              <p className="mt-1 text-body text-ink-secondary">{item.body}</p>
            </div>
          </label>
        ))}
      </div>

      <Button size="lg" onClick={submit} disabled={!allAccepted}>
        I agree to all of the above
      </Button>

      <p className="text-caption text-ink-tertiary">
        You can withdraw from the program at any time, and your VA benefits, employment, and any external care are not affected.
      </p>
    </div>
  );
}
