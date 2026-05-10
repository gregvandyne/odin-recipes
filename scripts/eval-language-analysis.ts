/**
 * Language analysis eval runner.
 *
 * Runs the active layer-4 prompt against each anchored case in
 * evals/language-analysis-v1/cases.jsonl and reports F1 per marker plus
 * explicit-risk recall.
 *
 * Pass criteria for prompt-version bump:
 *   HOPELESSNESS recall ≥ 0.90
 *   FINALITY recall     ≥ 0.90
 *   explicit-risk recall ≥ 1.00 (zero false negatives tolerated)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npm run eval:language
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeOpenEndedResponse } from "../src/lib/ai/client";

interface EvalCase {
  id: string;
  input: string;
  expectedMarkers: string[];
  expectedExplicitRisk: boolean;
  expectedSeverityFloor: "GREEN" | "YELLOW" | "ORANGE" | "RED";
}

const SEVERITY_RANK: Record<string, number> = { GREEN: 0, YELLOW: 1, ORANGE: 2, RED: 3 };
const MARKERS = ["HOPELESSNESS", "FINALITY", "ISOLATION", "LOSS_OF_PURPOSE", "SPECIFIC_STRESSOR"] as const;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is required to run the language eval");
    process.exit(2);
  }

  const path = join(__dirname, "..", "evals", "language-analysis-v1", "cases.jsonl");
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim());
  const cases: EvalCase[] = lines.map((l) => JSON.parse(l));

  console.log(`Running ${cases.length} eval cases against the active prompt…`);

  // Per-marker counts: tp / fp / fn.
  const stats: Record<string, { tp: number; fp: number; fn: number }> = {};
  for (const m of MARKERS) stats[m] = { tp: 0, fp: 0, fn: 0 };
  let explicitRisk = { tp: 0, fp: 0, fn: 0, tn: 0 };
  let severityFloorViolations = 0;

  for (const c of cases) {
    let out;
    try {
      out = await analyzeOpenEndedResponse({
        organizationId: "eval",
        veteranId: "eval",
        veteranDisplayName: null,
        openEndedResponse: c.input,
      });
    } catch (err) {
      console.warn(`[${c.id}] AI call failed: ${(err as Error).message}`);
      continue;
    }
    const got = out.analysis;
    const gotMarkers = new Set(got.markers.filter((m) => m.confidence >= 0.5).map((m) => m.marker));
    const expected = new Set(c.expectedMarkers);

    for (const m of MARKERS) {
      const inExpected = expected.has(m);
      const inGot = gotMarkers.has(m);
      if (inExpected && inGot) stats[m]!.tp += 1;
      else if (inExpected && !inGot) stats[m]!.fn += 1;
      else if (!inExpected && inGot) stats[m]!.fp += 1;
    }

    if (c.expectedExplicitRisk && got.explicitRiskLanguage) explicitRisk.tp += 1;
    else if (c.expectedExplicitRisk && !got.explicitRiskLanguage) explicitRisk.fn += 1;
    else if (!c.expectedExplicitRisk && got.explicitRiskLanguage) explicitRisk.fp += 1;
    else explicitRisk.tn += 1;

    const gotRank = SEVERITY_RANK[got.recommendedSeverity] ?? 0;
    const floorRank = SEVERITY_RANK[c.expectedSeverityFloor] ?? 0;
    if (gotRank < floorRank) {
      severityFloorViolations += 1;
      console.log(
        `[${c.id}] severity below floor: got ${got.recommendedSeverity}, floor ${c.expectedSeverityFloor}`,
      );
    }
  }

  console.log("\nPer-marker F1:");
  let pass = true;
  for (const m of MARKERS) {
    const s = stats[m]!;
    const precision = s.tp + s.fp === 0 ? 1 : s.tp / (s.tp + s.fp);
    const recall = s.tp + s.fn === 0 ? 1 : s.tp / (s.tp + s.fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    console.log(
      `  ${m.padEnd(18)} P=${precision.toFixed(2)} R=${recall.toFixed(2)} F1=${f1.toFixed(2)}`,
    );
    if ((m === "HOPELESSNESS" || m === "FINALITY") && recall < 0.9) {
      console.log(`    ✗ ${m} recall ${recall.toFixed(2)} < 0.90 — release blocker`);
      pass = false;
    }
  }

  const erRecall = explicitRisk.tp + explicitRisk.fn === 0
    ? 1
    : explicitRisk.tp / (explicitRisk.tp + explicitRisk.fn);
  const erFp = explicitRisk.fp;
  console.log(`\nExplicit-risk language: recall=${erRecall.toFixed(2)} false_positives=${erFp}`);
  if (erRecall < 1) {
    console.log("    ✗ explicit-risk recall < 1.00 — release blocker (zero FN tolerated)");
    pass = false;
  }

  console.log(`\nSeverity-floor violations: ${severityFloorViolations}`);
  if (severityFloorViolations > 0) {
    console.log("    ✗ AI recommended a severity below the case's expected floor");
    pass = false;
  }

  if (pass) {
    console.log("\nLanguage eval PASSED ✓");
  } else {
    console.log("\nLanguage eval FAILED ✗");
    process.exit(1);
  }
}

main();
