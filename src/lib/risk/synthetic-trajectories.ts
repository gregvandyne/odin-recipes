/**
 * Synthetic veteran trajectory generator.
 *
 * Produces deterministic check-in sequences for backtesting the risk engine.
 * Five archetypes:
 *   - stable:        steady, calm scores. Engine should output GREEN almost
 *                    always.
 *   - deteriorating: gradual worsening across multiple domains. Engine should
 *                    surface YELLOW → ORANGE in the back half.
 *   - acuteCrisis:   sudden multi-domain spike with explicit risk language.
 *                    Engine MUST flag RED.
 *   - falsePositiveProne:
 *                    one-off bad week followed by recovery. Engine should
 *                    YELLOW briefly, never escalate to ORANGE.
 *   - silent:        increasing missed-check-in count. Engine should escalate
 *                    via the silence-weighting layer.
 *
 * Seeded RNG so the same seed produces the same dataset.
 */

import type {
  CheckInRecord,
  CheckInResponse,
  DomainCode,
  RiskLevel,
} from "./types";
import { CANONICAL_QUESTIONS } from "@/lib/questions/canonical";

export type Archetype = "stable" | "deteriorating" | "acuteCrisis" | "falsePositiveProne" | "silent";

export interface SyntheticTrajectory {
  veteranId: string;
  archetype: Archetype;
  weeks: SyntheticWeek[];
  expectedFinalRiskLevel: RiskLevel;
  expectedShouldFlag: boolean;
}

export interface SyntheticWeek {
  weekNumber: number;
  /** null = veteran missed this week. */
  checkIn: CheckInRecord | null;
  expectedRiskLevel: RiskLevel;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a single trajectory for the given archetype.
 *
 * @param archetype trajectory pattern
 * @param weeks     length of the series
 * @param seed      RNG seed for repeatable noise
 */
export function buildTrajectory(
  archetype: Archetype,
  weeks: number,
  seed: number,
): SyntheticTrajectory {
  const rand = mulberry32(seed);
  const veteranId = `synth-${archetype}-${seed}`;
  const out: SyntheticWeek[] = [];

  for (let w = 1; w <= weeks; w++) {
    const t = w / weeks; // 0..1 progress
    let baseScore: number;
    let openEnded: string | null = null;
    let missed = false;

    switch (archetype) {
      case "stable":
        baseScore = 25 + (rand() - 0.5) * 10;
        break;
      case "deteriorating":
        baseScore = 25 + t * 50 + (rand() - 0.5) * 8;
        break;
      case "acuteCrisis":
        baseScore = w === weeks ? 90 : 30 + (rand() - 0.5) * 10;
        if (w === weeks) {
          openEnded = "I don't see how this gets better. Sometimes I think everyone would be better off without me.";
        }
        break;
      case "falsePositiveProne":
        baseScore = w === Math.floor(weeks / 2) ? 65 : 28 + (rand() - 0.5) * 8;
        break;
      case "silent":
        missed = w > weeks - 3;
        baseScore = 35 + (rand() - 0.5) * 8;
        break;
    }

    if (missed) {
      out.push({ weekNumber: w, checkIn: null, expectedRiskLevel: w === weeks ? "ORANGE" : "YELLOW" });
      continue;
    }

    const responses = synthResponses(baseScore, rand);
    const checkIn: CheckInRecord = {
      id: `${veteranId}-w${w}`,
      weekNumber: w,
      submittedAt: new Date(2026, 0, 1 + w * 7),
      responses,
      openEndedResponse: openEnded,
    };
    out.push({
      weekNumber: w,
      checkIn,
      expectedRiskLevel: expectedLevelFor(archetype, w, weeks, baseScore),
    });
  }

  return {
    veteranId,
    archetype,
    weeks: out,
    expectedFinalRiskLevel: out[out.length - 1]!.expectedRiskLevel,
    expectedShouldFlag: out[out.length - 1]!.expectedRiskLevel !== "GREEN",
  };
}

function expectedLevelFor(arc: Archetype, w: number, total: number, score: number): RiskLevel {
  switch (arc) {
    case "stable": return "GREEN";
    case "deteriorating": return w >= total - 1 ? "ORANGE" : w > total / 2 ? "YELLOW" : "GREEN";
    case "acuteCrisis": return w === total ? "RED" : "GREEN";
    case "falsePositiveProne": return w === Math.floor(total / 2) ? "YELLOW" : "GREEN";
    case "silent": return w > total - 3 ? "ORANGE" : "GREEN";
    default: return score >= 70 ? "YELLOW" : "GREEN";
  }
}

function synthResponses(baseScore: number, rand: () => number): CheckInResponse[] {
  // Build a response per canonical question. Map base score (0..100) into
  // a per-question value of the right type.
  return CANONICAL_QUESTIONS.map((q) => {
    const noise = (rand() - 0.5) * 15;
    const target = clamp(baseScore + noise, 0, 100);
    const value = mapScoreToResponseValue(q.responseType, target);
    return {
      questionId: q.id,
      domainCode: q.domainCode as DomainCode,
      responseType: q.responseType,
      value,
      skipped: false,
      weight: q.weight,
    };
  });
}

function mapScoreToResponseValue(
  type: CheckInResponse["responseType"],
  score: number,
): number | string | null {
  switch (type) {
    case "LIKERT_5":
      return Math.round(1 + (score / 100) * 4); // 1..5
    case "YES_NO":
      return score > 50 ? 1 : 0;
    case "HOURS":
      // Score 0 = 8h sleep (best). Score 100 = 3h sleep (worst).
      return Math.max(2, 8 - (score / 100) * 5);
    case "OPEN_TEXT":
      return null;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Build a balanced dataset with `count` trajectories of each archetype.
 */
export function buildDataset(count: number, weeks = 12, baseSeed = 1): SyntheticTrajectory[] {
  const archetypes: Archetype[] = [
    "stable",
    "deteriorating",
    "acuteCrisis",
    "falsePositiveProne",
    "silent",
  ];
  const out: SyntheticTrajectory[] = [];
  for (let i = 0; i < count; i++) {
    for (const a of archetypes) {
      out.push(buildTrajectory(a, weeks, baseSeed + out.length * 1009));
    }
  }
  return out;
}
