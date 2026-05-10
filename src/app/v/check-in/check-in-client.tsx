"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckInQuestion, type CheckInAnswer } from "@/components/sentinel/check-in-question";
import type { CanonicalQuestion } from "@/lib/questions/canonical";

/**
 * Check-in client.
 *
 * - Pre-fills from a saved draft (server-rendered) so a veteran can resume
 *   on a different device.
 * - Debounces 800ms PUT to /api/check-ins/draft as the veteran answers.
 * - Submits with an `Idempotency-Key` header so a network retry doesn't
 *   create duplicate check-ins.
 * - Shows a quiet "Saved" indicator. Never anxiety-inducing language.
 */

export interface DraftSnapshot {
  responses: { questionId: string; value: number | string | null; skipped: boolean }[];
  openEndedResponse: string | null;
  lastUpdatedAt: string;
}

interface Props {
  weekNumber: number;
  questions: CanonicalQuestion[];
  openEndedPrompt: string;
  initialDraft: DraftSnapshot | null;
}

const DRAFT_DEBOUNCE_MS = 800;

export function CheckInClient({ weekNumber, questions, openEndedPrompt, initialDraft }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(initialDraft ? initialStepFor(questions, initialDraft) : 0);
  const [answers, setAnswers] = useState<CheckInAnswer[]>(initialDraft?.responses ?? []);
  const [openText, setOpenText] = useState<string>(initialDraft?.openEndedResponse ?? "");
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [submitting, setSubmitting] = useState(false);

  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const totalSteps = questions.length + 1;
  const onLastQuestion = step === questions.length;

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotRef = useRef<string>("");

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const snapshot = JSON.stringify({ answers, openText });
    if (snapshot === lastSnapshotRef.current) return;
    lastSnapshotRef.current = snapshot;

    debounceTimer.current = setTimeout(() => {
      void persistDraft({
        weekNumber,
        responses: answers,
        openEndedResponse: openText.trim().length > 0 ? openText : null,
        setStatus: setDraftStatus,
      });
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [answers, openText, weekNumber]);

  function recordAnswer(answer: CheckInAnswer) {
    setAnswers((prev) => [...prev.filter((a) => a.questionId !== answer.questionId), answer]);
    setStep((s) => s + 1);
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/check-ins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          weekNumber,
          answers,
          openEndedResponse: openText.trim() || null,
        }),
      });
    } catch {
      // Service worker queues this for retry. Continue to the calm completion
      // screen so the veteran isn't blocked by a transient network error.
    }
    router.push("/v/check-in/done");
  }

  if (step < questions.length) {
    const q = questions[step]!;
    const initialForQ = initialDraft?.responses.find((r) => r.questionId === q.id);
    const initialAnswer: CheckInAnswer | undefined = initialForQ
      ? { questionId: initialForQ.questionId, value: initialForQ.value, skipped: initialForQ.skipped }
      : undefined;
    return (
      <div className="space-y-4">
        <DraftStatus status={draftStatus} />
        <CheckInQuestion
          question={q}
          questionNumber={step + 1}
          totalQuestions={totalSteps}
          onAnswer={recordAnswer}
          initial={initialAnswer}
        />
      </div>
    );
  }

  if (onLastQuestion) {
    return (
      <div className="flex min-h-[70vh] flex-col">
        <DraftStatus status={draftStatus} />
        <div className="mt-2 flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i < totalSteps ? "bg-ink-primary" : "bg-border"}`}
            />
          ))}
        </div>

        <h1 className="mt-12 text-balance text-display font-semibold text-ink-primary">
          {openEndedPrompt}
        </h1>

        <textarea
          value={openText}
          onChange={(e) => setOpenText(e.target.value)}
          rows={6}
          placeholder="If you want to. No pressure."
          className="mt-8 w-full rounded-md border border-border bg-canvas-card p-4 text-body-lg text-ink-primary placeholder:text-ink-tertiary"
          aria-label="Open-ended response"
        />

        <div className="mt-8 flex flex-col gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="h-12 rounded-md bg-primary text-body font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Done"}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="h-12 text-body text-ink-tertiary hover:underline"
          >
            Skip and finish
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function initialStepFor(questions: CanonicalQuestion[], draft: DraftSnapshot): number {
  // Resume on the first unanswered question (or open-ended if all answered).
  for (let i = 0; i < questions.length; i++) {
    const id = questions[i]!.id;
    if (!draft.responses.some((r) => r.questionId === id)) return i;
  }
  return questions.length;
}

async function persistDraft(args: {
  weekNumber: number;
  responses: CheckInAnswer[];
  openEndedResponse: string | null;
  setStatus: (s: "idle" | "saving" | "saved" | "offline") => void;
}): Promise<void> {
  args.setStatus("saving");
  try {
    const res = await fetch("/api/check-ins/draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekNumber: args.weekNumber,
        responses: args.responses,
        openEndedResponse: args.openEndedResponse,
      }),
    });
    if (!res.ok) throw new Error(`draft save failed: ${res.status}`);
    args.setStatus("saved");
  } catch {
    // Service worker queues for retry. Surface that to the veteran calmly.
    args.setStatus("offline");
  }
}

function DraftStatus({ status }: { status: "idle" | "saving" | "saved" | "offline" }) {
  if (status === "idle") return null;
  const text =
    status === "saving"
      ? "Saving…"
      : status === "saved"
      ? "Saved"
      : "Saved — we'll send it when you're back online";
  return (
    <p className="text-caption text-ink-tertiary" aria-live="polite">
      {text}
    </p>
  );
}
