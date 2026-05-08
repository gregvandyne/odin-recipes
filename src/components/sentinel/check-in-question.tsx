"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CanonicalQuestion } from "@/lib/questions/canonical";

/**
 * CheckInQuestion — one question, one screen.
 *
 * Variants: LIKERT_5 (vertical row stack, thumb-input friendly), YES_NO,
 * HOURS, OPEN_TEXT. Skip is always available. Skip advances without comment.
 */
export interface CheckInAnswer {
  questionId: string;
  value: number | string | null;
  skipped: boolean;
}

interface Props {
  question: CanonicalQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answer: CheckInAnswer) => void;
  initial?: CheckInAnswer;
}

export function CheckInQuestion({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  initial,
}: Props) {
  return (
    <div className="flex min-h-[70vh] flex-col">
      <ProgressDots current={questionNumber} total={totalQuestions} />

      <div className="mt-12 flex-1">
        <h1 className="text-balance text-display font-semibold text-ink-primary">
          {question.questionText}
        </h1>

        <div className="mt-8">
          {question.responseType === "LIKERT_5" && (
            <LikertInput question={question} initial={initial} onAnswer={onAnswer} />
          )}
          {question.responseType === "YES_NO" && (
            <YesNoInput question={question} initial={initial} onAnswer={onAnswer} />
          )}
          {question.responseType === "HOURS" && (
            <HoursInput question={question} initial={initial} onAnswer={onAnswer} />
          )}
          {question.responseType === "OPEN_TEXT" && (
            <OpenTextInput question={question} initial={initial} onAnswer={onAnswer} />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAnswer({ questionId: question.id, value: null, skipped: true })}
        className="mt-8 self-center text-body text-ink-tertiary underline-offset-4 hover:underline"
      >
        Skip this one
      </button>
    </div>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Question ${current} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i + 1 <= current ? "bg-ink-primary" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function LikertInput({
  question,
  initial,
  onAnswer,
}: {
  question: CanonicalQuestion;
  initial?: CheckInAnswer;
  onAnswer: (a: CheckInAnswer) => void;
}) {
  const anchors = question.anchors ?? ["1", "2", "3", "4", "5"];
  const [selected, setSelected] = useState<number | null>(
    typeof initial?.value === "number" ? initial.value : null,
  );

  return (
    <div className="flex flex-col gap-2" role="radiogroup">
      {anchors.map((label, i) => {
        const value = i + 1;
        const isSelected = selected === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => {
              setSelected(value);
              onAnswer({ questionId: question.id, value, skipped: false });
            }}
            className={cn(
              "min-h-[3.25rem] rounded-md border px-5 py-3 text-left text-body-lg transition-colors",
              isSelected
                ? "border-primary bg-primary/5 text-ink-primary"
                : "border-border bg-canvas-card text-ink-primary hover:bg-canvas-banded",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function YesNoInput({
  question,
  initial,
  onAnswer,
}: {
  question: CanonicalQuestion;
  initial?: CheckInAnswer;
  onAnswer: (a: CheckInAnswer) => void;
}) {
  const [selected, setSelected] = useState<number | null>(
    typeof initial?.value === "number" ? initial.value : null,
  );
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup">
      {[
        { label: "Yes", value: 0 },
        { label: "No", value: 1 },
      ].map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={selected === opt.value}
          onClick={() => {
            setSelected(opt.value);
            onAnswer({ questionId: question.id, value: opt.value, skipped: false });
          }}
          className={cn(
            "min-h-[3.25rem] rounded-md border px-5 py-3 text-body-lg",
            selected === opt.value
              ? "border-primary bg-primary/5"
              : "border-border bg-canvas-card hover:bg-canvas-banded",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function HoursInput({
  question,
  initial,
  onAnswer,
}: {
  question: CanonicalQuestion;
  initial?: CheckInAnswer;
  onAnswer: (a: CheckInAnswer) => void;
}) {
  const [hours, setHours] = useState<string>(
    typeof initial?.value === "number" ? String(initial.value) : "",
  );
  return (
    <div className="flex flex-col gap-3">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={16}
        step={0.5}
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        onBlur={() => {
          const n = Number(hours);
          if (Number.isFinite(n) && n >= 0 && n <= 16) {
            onAnswer({ questionId: question.id, value: n, skipped: false });
          }
        }}
        aria-label={question.questionText}
        className="h-14 w-full rounded-md border border-border bg-canvas-card px-4 text-display text-ink-primary"
        placeholder="hours"
      />
    </div>
  );
}

function OpenTextInput({
  question,
  initial,
  onAnswer,
}: {
  question: CanonicalQuestion;
  initial?: CheckInAnswer;
  onAnswer: (a: CheckInAnswer) => void;
}) {
  const [text, setText] = useState<string>(typeof initial?.value === "string" ? initial.value : "");
  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim().length > 0) {
          onAnswer({ questionId: question.id, value: text, skipped: false });
        }
      }}
      placeholder="If you want to. No pressure."
      rows={6}
      className="w-full rounded-md border border-border bg-canvas-card p-4 text-body-lg text-ink-primary placeholder:text-ink-tertiary"
      aria-label={question.questionText}
    />
  );
}
