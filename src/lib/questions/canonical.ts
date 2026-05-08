/**
 * Canonical question bank — Sentinel platform v1.
 *
 * Every question is mapped to a canonical domain so cross-org evaluation
 * remains possible even when organizations override individual questions.
 *
 * Question design rules (see prompt):
 *   - No clinical jargon. No PHQ-9 wording. Validated instruments translated
 *     into plain language.
 *   - 5-point Likert uses word anchors, not numbers.
 *   - Open-ended is optional, never required.
 *   - Skipping is signal, not penalty.
 */

import { DomainCode, ResponseType } from "../risk/types";

export interface CanonicalQuestion {
  id: string;
  domainCode: DomainCode;
  version: number;
  questionText: string;
  responseType: ResponseType;
  weight: number;
  /** Which weeks of the 52-week program this rotation appears. */
  rotationGroup: number;
  /** For LIKERT_5: word anchors. Index 0 = least concerning, 4 = most. */
  anchors?: [string, string, string, string, string];
}

export const CANONICAL_QUESTIONS: CanonicalQuestion[] = [
  // SLEEP — every week
  {
    id: "sleep-hours-v1",
    domainCode: "SLEEP",
    version: 1,
    questionText: "On most nights this week, about how many hours did you sleep?",
    responseType: "HOURS",
    weight: 1.5,
    rotationGroup: 1,
  },
  {
    id: "sleep-quality-v1",
    domainCode: "SLEEP",
    version: 1,
    questionText: "How rested do you feel when you wake up?",
    responseType: "LIKERT_5",
    weight: 1.0,
    rotationGroup: 1,
    anchors: ["Fully rested", "Mostly rested", "Somewhere in between", "Not very rested", "Not at all rested"],
  },

  // MOOD — every week
  {
    id: "mood-overall-v1",
    domainCode: "MOOD",
    version: 1,
    questionText: "Overall, how have you been feeling this week?",
    responseType: "LIKERT_5",
    weight: 1.5,
    rotationGroup: 1,
    anchors: ["Pretty good", "Mostly okay", "Up and down", "Mostly low", "Pretty low"],
  },

  // CONNECTION — every week
  {
    id: "connection-meaningful-v1",
    domainCode: "CONNECTION",
    version: 1,
    questionText: "Did you have at least one conversation this week that meant something to you?",
    responseType: "YES_NO",
    weight: 1.5,
    rotationGroup: 1,
  },
  {
    id: "connection-isolation-v1",
    domainCode: "CONNECTION",
    version: 1,
    questionText: "How alone have you felt this week?",
    responseType: "LIKERT_5",
    weight: 1.0,
    rotationGroup: 1,
    anchors: ["Not alone", "Rarely alone", "Sometimes alone", "Often alone", "Almost always alone"],
  },

  // PURPOSE
  {
    id: "purpose-direction-v1",
    domainCode: "PURPOSE",
    version: 1,
    questionText: "How clear has it felt this week, what you're doing and why?",
    responseType: "LIKERT_5",
    weight: 1.0,
    rotationGroup: 2,
    anchors: ["Very clear", "Mostly clear", "Mixed", "Mostly unclear", "Very unclear"],
  },

  // FINANCE
  {
    id: "finance-stress-v1",
    domainCode: "FINANCE",
    version: 1,
    questionText: "How much has money been on your mind this week?",
    responseType: "LIKERT_5",
    weight: 1.0,
    rotationGroup: 2,
    anchors: ["Not at all", "A little", "Some", "A lot", "Constantly"],
  },

  // SUBSTANCE
  {
    id: "substance-use-v1",
    domainCode: "SUBSTANCE",
    version: 1,
    questionText: "How would you describe your drinking or substance use this week?",
    responseType: "LIKERT_5",
    weight: 1.5,
    rotationGroup: 3,
    anchors: ["None or moderate", "About usual", "More than usual", "A lot more than usual", "Out of hand"],
  },

  // PAIN
  {
    id: "pain-level-v1",
    domainCode: "PAIN",
    version: 1,
    questionText: "How much physical pain have you been dealing with this week?",
    responseType: "LIKERT_5",
    weight: 1.0,
    rotationGroup: 3,
    anchors: ["None", "A little", "Some", "A lot", "Constant"],
  },

  // RELATIONSHIP
  {
    id: "relationship-tension-v1",
    domainCode: "RELATIONSHIP",
    version: 1,
    questionText: "How much tension has there been in your closest relationships this week?",
    responseType: "LIKERT_5",
    weight: 1.0,
    rotationGroup: 4,
    anchors: ["None", "A little", "Some", "A lot", "Constant"],
  },

  // HOUSING
  {
    id: "housing-stable-v1",
    domainCode: "HOUSING",
    version: 1,
    questionText: "Is your housing situation stable right now?",
    responseType: "LIKERT_5",
    weight: 1.0,
    rotationGroup: 4,
    anchors: ["Very stable", "Mostly stable", "Some uncertainty", "Mostly unstable", "Very unstable"],
  },
];

export const OPEN_ENDED_PROMPTS = [
  "What's the hardest part of this week?",
  "What would make next week better?",
  "Who did you talk to that mattered?",
  "What's something you're proud of from this week?",
  "What's weighing on you right now?",
];

/**
 * Build a check-in for a given week. Always include: 1 mood, 1 sleep,
 * 1 connection, 1 open-ended. Rotate the rest.
 */
export function buildWeeklyCheckInQuestions(weekNumber: number): CanonicalQuestion[] {
  const required = CANONICAL_QUESTIONS.filter((q) => q.rotationGroup === 1);
  const rotation = (weekNumber % 4) + 1;
  const rotated = CANONICAL_QUESTIONS.filter((q) => q.rotationGroup === rotation && q.rotationGroup !== 1);
  return [...required, ...rotated];
}

export function openEndedForWeek(weekNumber: number): string {
  return OPEN_ENDED_PROMPTS[weekNumber % OPEN_ENDED_PROMPTS.length]!;
}
