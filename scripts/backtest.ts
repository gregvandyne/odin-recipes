/**
 * Engine backtest harness.
 *
 * Runs the deterministic risk engine against a synthetic dataset of veteran
 * trajectories with known-correct outcomes and reports a confusion matrix.
 *
 * This is a release-blocker, not a CI test — the dataset is large enough that
 * running it inline on every push would slow the suite. Run before any
 * threshold change in src/lib/risk/engine.ts:
 *
 *   npm run backtest
 *
 * Pass criteria for a phase ship:
 *   RED recall   ≥ 0.95   (we must not miss explicit-risk cases)
 *   GREEN precision ≥ 0.85 (we must not drown coordinators in false positives)
 */

import { score } from "../src/lib/risk/engine";
import { buildDataset } from "../src/lib/risk/synthetic-trajectories";
import type { CheckInRecord, RiskLevel } from "../src/lib/risk/types";

type Cell = Record<RiskLevel, number>;
const LEVELS: RiskLevel[] = ["GREEN", "YELLOW", "ORANGE", "RED"];

function emptyCell(): Cell {
  return { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
}

function main() {
  const count = parseInt(process.env.BACKTEST_PER_ARCHETYPE ?? "200", 10);
  const dataset = buildDataset(count);

  // confusion[expected][predicted] = count
  const confusion: Record<RiskLevel, Cell> = {
    GREEN: emptyCell(),
    YELLOW: emptyCell(),
    ORANGE: emptyCell(),
    RED: emptyCell(),
  };

  for (const traj of dataset) {
    // Walk forward week by week so the engine has progressively more history.
    let priorRiskLevel: RiskLevel | null = null;
    let consecutiveMissed = 0;
    let lastPredicted: RiskLevel = "GREEN";

    for (const w of traj.weeks) {
      const history: CheckInRecord[] = traj.weeks
        .filter((x) => x.weekNumber < w.weekNumber && x.checkIn !== null)
        .map((x) => x.checkIn as CheckInRecord)
        .reverse();

      if (w.checkIn === null) {
        consecutiveMissed += 1;
        const out = score({
          current: null,
          history,
          hoursSinceCheckInWindowOpen: 168,
          consecutiveMissedWeeks: consecutiveMissed,
          priorRiskLevel,
          languageAnalysis: null,
        });
        lastPredicted = out.overallRiskLevel;
        priorRiskLevel = out.overallRiskLevel;
        continue;
      }

      consecutiveMissed = 0;
      // For acuteCrisis trajectories the open-ended response carries the
      // explicit risk language. Engine layer 4 is gated on a real AI call,
      // so for backtest we simulate the worker's output deterministically:
      // any open-ended containing one of these phrases is treated as
      // explicit-risk language.
      const langInput = simulateLanguageAnalysis(w.checkIn.openEndedResponse);

      const out = score({
        current: w.checkIn,
        history,
        hoursSinceCheckInWindowOpen: 0,
        consecutiveMissedWeeks: 0,
        priorRiskLevel,
        languageAnalysis: langInput,
      });
      lastPredicted = out.overallRiskLevel;
      priorRiskLevel = out.overallRiskLevel;
    }

    confusion[traj.expectedFinalRiskLevel][lastPredicted] += 1;
  }

  printReport(confusion, dataset.length);
}

function simulateLanguageAnalysis(open: string | null): import("../src/lib/risk/types").LanguageAnalysis | null {
  if (!open) return null;
  const lower = open.toLowerCase();
  const explicit = /better off without me|kill myself|end (it|my life)|no reason to/.test(lower);
  return {
    promptVersion: "synth-v1",
    model: "synth",
    markers: explicit ? [{ marker: "FINALITY", confidence: 0.95 }] : [],
    recommendedSeverity: explicit ? "RED" : "GREEN",
    explicitRiskLanguage: explicit,
  };
}

function printReport(confusion: Record<RiskLevel, Cell>, total: number) {
  console.log("\nSentinel engine backtest");
  console.log("------------------------");
  console.log(`Total trajectories: ${total}\n`);

  // Confusion matrix
  const w = 9;
  const header = ["expected\\predicted", ...LEVELS].map((s) => s.padEnd(w)).join("");
  console.log(header);
  console.log("".padEnd(header.length, "-"));
  for (const exp of LEVELS) {
    const row = [exp.padEnd(w), ...LEVELS.map((p) => String(confusion[exp][p]).padEnd(w))].join("");
    console.log(row);
  }

  // Per-class precision/recall
  console.log("\nPer-class precision / recall:");
  let allPass = true;
  for (const lvl of LEVELS) {
    const tp = confusion[lvl][lvl];
    const fn = LEVELS.filter((l) => l !== lvl).reduce((s, l) => s + confusion[lvl][l], 0);
    const fp = LEVELS.filter((l) => l !== lvl).reduce((s, l) => s + confusion[l][lvl], 0);
    const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
    console.log(
      `  ${lvl.padEnd(7)} precision=${precision.toFixed(3)}  recall=${recall.toFixed(3)}`,
    );

    if (lvl === "RED" && recall < 0.95) {
      console.log(`    ✗ RED recall ${recall.toFixed(3)} < 0.95 — release blocker`);
      allPass = false;
    }
    if (lvl === "GREEN" && precision < 0.85) {
      console.log(`    ✗ GREEN precision ${precision.toFixed(3)} < 0.85 — release blocker`);
      allPass = false;
    }
  }

  console.log("");
  if (allPass) {
    console.log("Backtest PASSED ✓");
  } else {
    console.log("Backtest FAILED ✗");
    process.exit(1);
  }
}

main();
