/**
 * Risk scoring engine — Sentinel v1.0.0
 *
 * Five layers of analysis combined into a single deterministic output.
 * Layers 1, 2, 3, 5 are fully deterministic from inputs.
 * Layer 4 (language analysis) is the only AI-influenced layer; the engine
 * accepts pre-computed `LanguageAnalysis` so the engine itself stays pure.
 *
 * Design tenets, in order of precedence:
 *   1. Trajectory matters more than snapshot.
 *   2. Compounding risk is the real risk.
 *   3. Silence is a signal.
 *   4. Better to over-flag than miss.
 *
 * The engine outputs an explanation, not just a score. Every flag carries the
 * domains involved so coordinators can see WHY.
 */

import {
  CheckInRecord,
  CheckInResponse,
  DOMAIN_CODES,
  DomainCode,
  DomainScore,
  RiskFlag,
  RiskLevel,
  RiskScoreInput,
  RiskScoreOutput,
  TrajectoryScore,
} from "./types";

export const ENGINE_VERSION = "v1.0.0";

// =============================================================================
// Tunables. Every threshold lives here so we can version and tune in one place.
// =============================================================================

const TRAJECTORY_SHIFT_THRESHOLD = 15; // points on the 0–100 domain scale
const COMPOUNDING_DOMAIN_COUNT = 3;     // 3+ domains shifting → COMPOUNDING_RISK
const HIGH_RISK_DOMAIN_TRIPLES: DomainCode[][] = [
  ["SLEEP", "MOOD", "CONNECTION"],
  ["SUBSTANCE", "RELATIONSHIP", "PAIN"],
  ["FINANCE", "MOOD", "CONNECTION"],
];

const RISK_LEVEL_RANK: Record<RiskLevel, number> = {
  GREEN: 0,
  YELLOW: 1,
  ORANGE: 2,
  RED: 3,
};

const RANK_TO_LEVEL: RiskLevel[] = ["GREEN", "YELLOW", "ORANGE", "RED"];

function maxLevel(...levels: RiskLevel[]): RiskLevel {
  let r = 0;
  for (const l of levels) r = Math.max(r, RISK_LEVEL_RANK[l]);
  return RANK_TO_LEVEL[r]!;
}

// =============================================================================
// Layer 1: Domain scores
// =============================================================================

/**
 * Normalize a single response to a 0–100 concerning-ness value.
 * Higher = more concerning. Skipped responses contribute as 50 (mild signal,
 * not zero) so the system doesn't reward avoidance. Open text contributes 0
 * here — language analysis happens in layer 4.
 */
function responseToScore(r: CheckInResponse): number | null {
  if (r.skipped) return 50;
  if (r.value === null) return null;

  switch (r.responseType) {
    case "LIKERT_5": {
      const v = typeof r.value === "number" ? r.value : Number(r.value);
      if (!Number.isFinite(v) || v < 1 || v > 5) return null;
      // 1 → 0, 5 → 100. Linear.
      return ((v - 1) / 4) * 100;
    }
    case "YES_NO": {
      const v = typeof r.value === "number" ? r.value : Number(r.value);
      return v >= 1 ? 100 : 0;
    }
    case "HOURS": {
      // Sleep hours is the canonical use. < 5 or > 10 = concerning.
      const v = typeof r.value === "number" ? r.value : Number(r.value);
      if (!Number.isFinite(v)) return null;
      if (v >= 7 && v <= 9) return 0;
      if (v >= 6 && v < 7) return 25;
      if (v >= 5 && v < 6) return 50;
      if (v >= 9 && v <= 10) return 25;
      return 90; // < 5 or > 10
    }
    case "OPEN_TEXT":
      return null; // Layer 4 handles open text
  }
}

export function computeDomainScores(checkIn: CheckInRecord | null): DomainScore[] {
  const empty: DomainScore[] = DOMAIN_CODES.map((d) => ({
    domain: d,
    score: 0,
    responseCount: 0,
    skippedCount: 0,
  }));
  if (!checkIn) return empty;

  const buckets = new Map<DomainCode, { sum: number; weight: number; count: number; skipped: number }>();
  for (const d of DOMAIN_CODES) buckets.set(d, { sum: 0, weight: 0, count: 0, skipped: 0 });

  for (const r of checkIn.responses) {
    const score = responseToScore(r);
    if (score === null) continue;
    const b = buckets.get(r.domainCode);
    if (!b) continue;
    b.sum += score * r.weight;
    b.weight += r.weight;
    b.count += 1;
    if (r.skipped) b.skipped += 1;
  }

  return DOMAIN_CODES.map((d) => {
    const b = buckets.get(d)!;
    return {
      domain: d,
      score: b.weight > 0 ? b.sum / b.weight : 0,
      responseCount: b.count,
      skippedCount: b.skipped,
    };
  });
}

// =============================================================================
// Layer 2: Trajectory
// =============================================================================

export function computeTrajectories(
  current: DomainScore[],
  history: CheckInRecord[],
): TrajectoryScore[] {
  // Build per-domain history of scores (most recent first → oldest last)
  const historicScores = history.map((c) => computeDomainScores(c));

  return current.map((cur) => {
    const last4 = historicScores.slice(0, 4);
    const last12 = historicScores.slice(0, 12);

    const baseline4 = avgDomainScore(last4, cur.domain);
    const baseline12 = avgDomainScore(last12, cur.domain);

    const shift4Week = baseline4 === null ? 0 : cur.score - baseline4;
    const shift12Week = baseline12 === null ? 0 : cur.score - baseline12;

    return {
      domain: cur.domain,
      shift4Week,
      shift12Week,
      trajectoryShifted:
        shift4Week >= TRAJECTORY_SHIFT_THRESHOLD ||
        shift12Week >= TRAJECTORY_SHIFT_THRESHOLD,
    };
  });
}

function avgDomainScore(history: DomainScore[][], domain: DomainCode): number | null {
  const vals: number[] = [];
  for (const week of history) {
    const d = week.find((w) => w.domain === domain);
    if (!d || d.responseCount === 0) continue;
    vals.push(d.score);
  }
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// =============================================================================
// Layer 3: Compounding patterns
// =============================================================================

export function detectCompoundingFlags(
  domainScores: DomainScore[],
  trajectories: TrajectoryScore[],
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const shifted = trajectories.filter((t) => t.trajectoryShifted).map((t) => t.domain);

  // Rule 1: 3+ domains shifting in the same week.
  if (shifted.length >= COMPOUNDING_DOMAIN_COUNT) {
    flags.push({
      flagType: "COMPOUNDING_RISK",
      severity: "ORANGE",
      explanation: `${shifted.length} domains showed worsening trajectory this week (${shifted.join(", ")}). Compounding patterns warrant outreach.`,
      domainsInvolved: shifted,
    });
  }

  // Rule 2: Specific high-risk triples elevate to ORANGE even at lower thresholds.
  for (const triple of HIGH_RISK_DOMAIN_TRIPLES) {
    const allShifted = triple.every((d) => shifted.includes(d));
    if (allShifted) {
      flags.push({
        flagType: "COMPOUNDING_RISK",
        severity: "ORANGE",
        explanation: `Known high-risk pattern detected: ${triple.join(" + ")} all degraded together.`,
        domainsInvolved: [...triple],
      });
    }
  }

  // Rule 3: A single domain with very high absolute score (≥80) earns YELLOW.
  for (const ds of domainScores) {
    if (ds.score >= 80 && ds.responseCount > 0) {
      flags.push({
        flagType: "TRAJECTORY_SHIFT",
        severity: "YELLOW",
        explanation: `${ds.domain} score is ${Math.round(ds.score)}/100 this week — high absolute concern.`,
        domainsInvolved: [ds.domain],
      });
    }
  }

  // Rule 4: Per-domain trajectory shift earns YELLOW even if alone.
  for (const t of trajectories) {
    if (t.trajectoryShifted) {
      flags.push({
        flagType: "TRAJECTORY_SHIFT",
        severity: "YELLOW",
        explanation: `${t.domain} worsened by ${Math.round(t.shift4Week)} points vs. last 4 weeks.`,
        domainsInvolved: [t.domain],
      });
    }
  }

  return flags;
}

// =============================================================================
// Layer 4: Language analysis adapter
// (Layer 4 itself is performed by Claude — see src/lib/ai. This adapter
// converts the structured output into flags.)
// =============================================================================

export function languageFlagsFromAnalysis(
  analysis: RiskScoreInput["languageAnalysis"],
): RiskFlag[] {
  if (!analysis) return [];
  const flags: RiskFlag[] = [];

  if (analysis.explicitRiskLanguage) {
    flags.push({
      flagType: "EXPLICIT_RISK",
      severity: "RED",
      explanation:
        "Open-ended response contains explicit risk language. Immediate human review required.",
      domainsInvolved: [],
    });
    return flags;
  }

  for (const m of analysis.markers) {
    if (m.confidence < 0.5) continue;
    let severity: RiskLevel = "YELLOW";
    if (m.marker === "HOPELESSNESS" || m.marker === "FINALITY") severity = "ORANGE";
    flags.push({
      flagType: "LANGUAGE_MARKER",
      severity,
      explanation: `Language marker detected: ${m.marker} (confidence ${m.confidence.toFixed(2)}).`,
      domainsInvolved: [],
    });
  }

  // AI's recommended severity acts as a floor.
  if (analysis.recommendedSeverity !== "GREEN") {
    flags.push({
      flagType: "LANGUAGE_MARKER",
      severity: analysis.recommendedSeverity,
      explanation: `AI language analysis recommends minimum severity ${analysis.recommendedSeverity} based on tone and content of open-ended response.`,
      domainsInvolved: [],
    });
  }

  return flags;
}

// =============================================================================
// Layer 5: Silence weighting
// =============================================================================

export function silenceFlags(
  consecutiveMissedWeeks: number,
  priorRiskLevel: RiskLevel | null,
): RiskFlag[] {
  if (consecutiveMissedWeeks <= 0) return [];

  // Base severity escalates with consecutive misses.
  let severity: RiskLevel = "GREEN";
  if (consecutiveMissedWeeks === 1) severity = "YELLOW";
  if (consecutiveMissedWeeks >= 2) severity = "ORANGE";
  if (consecutiveMissedWeeks >= 3) severity = "RED";

  // Prior-week severity bumps the response up one level.
  if (priorRiskLevel) {
    if (priorRiskLevel === "YELLOW" && severity === "GREEN") severity = "YELLOW";
    if (priorRiskLevel === "ORANGE") severity = maxLevel(severity, "ORANGE");
    if (priorRiskLevel === "RED") severity = "RED";
  }

  return [
    {
      flagType: "MISSED_CHECKIN",
      severity,
      explanation:
        `${consecutiveMissedWeeks} consecutive missed check-in${consecutiveMissedWeeks === 1 ? "" : "s"}` +
        (priorRiskLevel && priorRiskLevel !== "GREEN"
          ? `. Prior week's risk level was ${priorRiskLevel}.`
          : "."),
      domainsInvolved: [],
    },
  ];
}

// =============================================================================
// Combine
// =============================================================================

function recommendation(level: RiskLevel): { action: string; hours: number; escalate: boolean } {
  switch (level) {
    case "RED":
      return {
        action:
          "Immediate outreach required. If explicit risk language was detected, follow crisis protocol and warm-handoff to Veterans Crisis Line (988).",
        hours: 1,
        escalate: true,
      };
    case "ORANGE":
      return {
        action:
          "Contact within 24 hours. Review full timeline, consult Clinical Lead if uncertain, log contact.",
        hours: 24,
        escalate: false,
      };
    case "YELLOW":
      return {
        action: "Contact within 48 hours. Acknowledge what they shared. Note next steps.",
        hours: 48,
        escalate: false,
      };
    case "GREEN":
      return {
        action:
          "No flag. Routine check-in cadence; no proactive outreach required this week unless other signals suggest otherwise.",
        hours: 168,
        escalate: false,
      };
  }
}

export function score(input: RiskScoreInput): RiskScoreOutput {
  const domainScores = computeDomainScores(input.current);
  const trajectories = computeTrajectories(domainScores, input.history);

  const flags: RiskFlag[] = [
    ...detectCompoundingFlags(domainScores, trajectories),
    ...languageFlagsFromAnalysis(input.languageAnalysis),
    ...silenceFlags(input.consecutiveMissedWeeks, input.priorRiskLevel),
  ];

  const overallRiskLevel = flags.length === 0 ? "GREEN" : maxLevel(...flags.map((f) => f.severity));

  // Overall score: weighted blend of average domain score and worst trajectory shift,
  // bounded 0–100. Used for rank-ordering the queue.
  const avgDomain =
    domainScores.filter((d) => d.responseCount > 0).reduce((a, b) => a + b.score, 0) /
    Math.max(1, domainScores.filter((d) => d.responseCount > 0).length);
  const worstShift = Math.max(0, ...trajectories.map((t) => Math.max(t.shift4Week, t.shift12Week)));
  const silenceBoost = Math.min(50, input.consecutiveMissedWeeks * 15);
  const overallScore = Math.min(100, 0.5 * avgDomain + 0.4 * worstShift + silenceBoost);

  const rec = recommendation(overallRiskLevel);

  // Force escalation on RED regardless; force escalation on EXPLICIT_RISK.
  const escalate =
    rec.escalate ||
    flags.some((f) => f.flagType === "EXPLICIT_RISK") ||
    overallRiskLevel === "RED";

  const explanation = buildExplanation(overallRiskLevel, flags, domainScores, trajectories);

  return {
    engineVersion: ENGINE_VERSION,
    overallRiskLevel,
    overallScore,
    domainScores,
    trajectories,
    flags,
    recommendedAction: rec.action,
    recommendedTimeframeHours: rec.hours,
    escalateToClinicalLead: escalate,
    explanation,
  };
}

function buildExplanation(
  level: RiskLevel,
  flags: RiskFlag[],
  domains: DomainScore[],
  trajectories: TrajectoryScore[],
): string {
  if (level === "GREEN" && flags.length === 0) {
    return "Stable across domains. No new flags.";
  }

  const parts: string[] = [`Overall risk: ${level}.`];
  const shifted = trajectories.filter((t) => t.trajectoryShifted);
  if (shifted.length > 0) {
    parts.push(
      `Trajectory shifts: ${shifted.map((t) => `${t.domain} (+${Math.round(t.shift4Week)})`).join(", ")}.`,
    );
  }
  const high = domains.filter((d) => d.score >= 70 && d.responseCount > 0);
  if (high.length > 0) {
    parts.push(
      `High absolute scores: ${high.map((d) => `${d.domain} ${Math.round(d.score)}`).join(", ")}.`,
    );
  }
  const reasons = flags.map((f) => f.explanation);
  if (reasons.length) parts.push(reasons.join(" "));
  return parts.join(" ");
}
