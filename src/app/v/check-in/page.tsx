"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckInQuestion, type CheckInAnswer } from "@/components/sentinel/check-in-question";
import {
  buildWeeklyCheckInQuestions,
  openEndedForWeek,
  type CanonicalQuestion,
} from "@/lib/questions/canonical";

/**
 * The check-in flow. Highest-stakes veteran-facing screen.
 *
 * Rules:
 *   - One question per screen.
 *   - Skip always available.
 *   - Open-ended optional.
 *   - Final screen is quiet acknowledgment, no celebration, no streak.
 *   - If a response triggers an internal flag, the veteran sees the same calm
 *     completion screen — they do NOT see "you've been flagged."
 */
const WEEK_NUMBER = 7; // In production: derived from veteran profile + program start.

export default function CheckInPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<CheckInAnswer[]>([]);
  const [openText, setOpenText] = useState("");

  const questions: CanonicalQuestion[] = buildWeeklyCheckInQuestions(WEEK_NUMBER);
  const totalSteps = questions.length + 1; // +1 for open-ended
  const onLastQuestion = step === questions.length;

  function recordAnswer(answer: CheckInAnswer) {
    const next = [...answers.filter((a) => a.questionId !== answer.questionId), answer];
    setAnswers(next);
    setStep((s) => s + 1);
  }

  async function submit() {
    // POST to /api/check-ins. Server runs the risk engine, persists, fans out.
    try {
      await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: WEEK_NUMBER,
          answers,
          openEndedResponse: openText.trim() || null,
        }),
      });
    } catch {
      // Quietly retry-queue in production. For now, proceed to completion screen.
    }
    router.push("/v/check-in/done");
  }

  if (step < questions.length) {
    const q = questions[step]!;
    return (
      <CheckInQuestion
        question={q}
        questionNumber={step + 1}
        totalQuestions={totalSteps}
        onAnswer={recordAnswer}
      />
    );
  }

  // Final step: open-ended prompt
  if (onLastQuestion) {
    return (
      <div className="flex min-h-[70vh] flex-col">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i < totalSteps ? "bg-ink-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        <h1 className="mt-12 text-balance text-display font-semibold text-ink-primary">
          {openEndedForWeek(WEEK_NUMBER)}
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
            className="h-12 rounded-md bg-primary text-body font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Done
          </button>
          <button
            type="button"
            onClick={submit}
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
