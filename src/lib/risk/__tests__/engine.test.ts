/**
 * Risk engine test harness — synthetic veteran trajectories with known
 * expected outputs. The risk engine is the heart of the system; this
 * file is treated as a contract.
 *
 * Coverage target: 90%+. Add a fixture for every behavior change.
 */
import { describe, expect, it } from "vitest";
import {
  computeDomainScores,
  computeTrajectories,
  detectCompoundingFlags,
  silenceFlags,
  score,
} from "../engine";
import { CheckInRecord, CheckInResponse, RiskScoreInput } from "../types";

function likert(domain: CheckInResponse["domainCode"], value: number, weight = 1): CheckInResponse {
  return {
    questionId: `${domain}-q-${value}`,
    domainCode: domain,
    responseType: "LIKERT_5",
    value,
    skipped: false,
    weight,
  };
}

function checkIn(week: number, responses: CheckInResponse[], openText: string | null = null): CheckInRecord {
  return {
    id: `ci-${week}`,
    weekNumber: week,
    submittedAt: new Date(2026, 0, 1 + week * 7),
    responses,
    openEndedResponse: openText,
  };
}

function baseInput(overrides: Partial<RiskScoreInput> = {}): RiskScoreInput {
  return {
    current: null,
    history: [],
    hoursSinceCheckInWindowOpen: 0,
    consecutiveMissedWeeks: 0,
    priorRiskLevel: null,
    languageAnalysis: null,
    ...overrides,
  };
}

describe("computeDomainScores", () => {
  it("returns zero scores when no check-in", () => {
    const out = computeDomainScores(null);
    expect(out.every((d) => d.score === 0 && d.responseCount === 0)).toBe(true);
  });

  it("maps Likert 1 → 0 and Likert 5 → 100", () => {
    const out = computeDomainScores(checkIn(1, [likert("MOOD", 1), likert("SLEEP", 5)]));
    expect(out.find((d) => d.domain === "MOOD")?.score).toBe(0);
    expect(out.find((d) => d.domain === "SLEEP")?.score).toBe(100);
  });

  it("treats skipped responses as 50 (mild signal, not zero)", () => {
    const out = computeDomainScores(
      checkIn(1, [{
        questionId: "q1", domainCode: "MOOD", responseType: "LIKERT_5", value: null, skipped: true, weight: 1,
      }]),
    );
    expect(out.find((d) => d.domain === "MOOD")?.score).toBe(50);
  });

  it("respects question weights", () => {
    const out = computeDomainScores(
      checkIn(1, [likert("MOOD", 5, 3), likert("MOOD", 1, 1)]),
    );
    // (100*3 + 0*1) / 4 = 75
    expect(out.find((d) => d.domain === "MOOD")?.score).toBe(75);
  });

  it("hours response: 7-9 = 0, <5 = 90", () => {
    const lowSleep: CheckInResponse = {
      questionId: "h1", domainCode: "SLEEP", responseType: "HOURS", value: 4, skipped: false, weight: 1,
    };
    const goodSleep: CheckInResponse = { ...lowSleep, value: 8, questionId: "h2" };
    expect(computeDomainScores(checkIn(1, [lowSleep])).find((d) => d.domain === "SLEEP")?.score).toBe(90);
    expect(computeDomainScores(checkIn(1, [goodSleep])).find((d) => d.domain === "SLEEP")?.score).toBe(0);
  });
});

describe("computeTrajectories", () => {
  it("flags trajectory shift when current exceeds 4-week baseline by threshold", () => {
    const history = [
      checkIn(1, [likert("MOOD", 1)]),
      checkIn(2, [likert("MOOD", 1)]),
      checkIn(3, [likert("MOOD", 2)]),
      checkIn(4, [likert("MOOD", 1)]),
    ];
    const current = computeDomainScores(checkIn(5, [likert("MOOD", 4)]));
    const t = computeTrajectories(current, history);
    expect(t.find((x) => x.domain === "MOOD")?.trajectoryShifted).toBe(true);
  });

  it("does not flag stable trajectories", () => {
    const history = [
      checkIn(1, [likert("MOOD", 2)]),
      checkIn(2, [likert("MOOD", 2)]),
      checkIn(3, [likert("MOOD", 2)]),
    ];
    const current = computeDomainScores(checkIn(4, [likert("MOOD", 2)]));
    const t = computeTrajectories(current, history);
    expect(t.find((x) => x.domain === "MOOD")?.trajectoryShifted).toBe(false);
  });
});

describe("detectCompoundingFlags", () => {
  it("raises COMPOUNDING_RISK when 3+ domains shift", () => {
    const history = [
      checkIn(1, [likert("SLEEP", 1), likert("MOOD", 1), likert("CONNECTION", 1)]),
      checkIn(2, [likert("SLEEP", 1), likert("MOOD", 1), likert("CONNECTION", 1)]),
    ];
    const current = computeDomainScores(
      checkIn(3, [likert("SLEEP", 5), likert("MOOD", 5), likert("CONNECTION", 5)]),
    );
    const t = computeTrajectories(current, history);
    const flags = detectCompoundingFlags(current, t);
    expect(flags.some((f) => f.flagType === "COMPOUNDING_RISK")).toBe(true);
  });
});

describe("silenceFlags", () => {
  it("returns nothing for zero missed weeks", () => {
    expect(silenceFlags(0, null)).toEqual([]);
  });

  it("escalates to RED on 3+ missed weeks", () => {
    const flags = silenceFlags(3, "GREEN");
    expect(flags[0]?.severity).toBe("RED");
  });

  it("bumps severity when prior week was ORANGE", () => {
    const flags = silenceFlags(1, "ORANGE");
    expect(flags[0]?.severity).toBe("ORANGE");
  });
});

describe("score (integration)", () => {
  it("returns GREEN with no flags when veteran is stable", () => {
    const history = Array.from({ length: 4 }, (_, i) =>
      checkIn(i + 1, [likert("MOOD", 2), likert("SLEEP", 2)]),
    );
    const current = checkIn(5, [likert("MOOD", 2), likert("SLEEP", 2)]);
    const out = score(baseInput({ current, history }));
    expect(out.overallRiskLevel).toBe("GREEN");
    expect(out.flags).toHaveLength(0);
  });

  it("forces RED on explicit risk language regardless of domain scores", () => {
    const current = checkIn(1, [likert("MOOD", 1)], "I'm tired of being here");
    const out = score(
      baseInput({
        current,
        languageAnalysis: {
          promptVersion: "test",
          model: "test",
          markers: [],
          recommendedSeverity: "GREEN",
          explicitRiskLanguage: true,
        },
      }),
    );
    expect(out.overallRiskLevel).toBe("RED");
    expect(out.escalateToClinicalLead).toBe(true);
    expect(out.flags.some((f) => f.flagType === "EXPLICIT_RISK")).toBe(true);
  });

  it("recommends action and timeframe per risk level", () => {
    const current = checkIn(1, [likert("MOOD", 5)]);
    const history = Array.from({ length: 4 }, (_, i) => checkIn(i + 1, [likert("MOOD", 1)]));
    const out = score(baseInput({ current, history }));
    expect(["YELLOW", "ORANGE", "RED"]).toContain(out.overallRiskLevel);
    expect(out.recommendedTimeframeHours).toBeLessThanOrEqual(48);
  });

  it("missed check-ins surface as flags even with no current check-in", () => {
    const out = score(baseInput({ consecutiveMissedWeeks: 2, priorRiskLevel: "YELLOW" }));
    expect(out.flags.some((f) => f.flagType === "MISSED_CHECKIN")).toBe(true);
    expect(out.overallRiskLevel).toBe("ORANGE");
  });

  it("is deterministic for identical inputs (layers 1, 2, 3, 5)", () => {
    const current = checkIn(5, [likert("MOOD", 4), likert("SLEEP", 5)]);
    const history = [checkIn(4, [likert("MOOD", 2), likert("SLEEP", 2)])];
    const a = score(baseInput({ current, history }));
    const b = score(baseInput({ current, history }));
    expect(a).toEqual(b);
  });
});
