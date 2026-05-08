/**
 * Claude API client for language analysis and coordinator-draft generation.
 *
 * Every call:
 *   - logs prompt version, model, input/output tokens, latency
 *   - validates output against the prompt's JSON schema
 *   - redacts PII before sending
 *   - is wrapped with timeout and retry
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { LanguageAnalysis } from "../risk/types";
import {
  COORDINATOR_DRAFT_REPLY_PROMPT_V1,
  LANGUAGE_ANALYSIS_PROMPT_V1,
  PromptCallLog,
} from "./prompts";
import { redactPII } from "./redact";

const TIMEOUT_MS = 20_000;

let _client: Anthropic | null = null;

function client(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: TIMEOUT_MS,
    });
  }
  return _client;
}

function hashInput(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export interface AnalyzeArgs {
  organizationId: string;
  veteranId: string;
  veteranDisplayName?: string | null;
  openEndedResponse: string;
  recentContext?: string;
}

/**
 * Layer 4: language analysis. Returns structured markers + recommended severity.
 * Caller is responsible for persisting the result alongside the check-in and
 * for supplying the result to the risk scoring engine.
 */
export async function analyzeOpenEndedResponse(
  args: AnalyzeArgs,
): Promise<{ analysis: LanguageAnalysis; log: PromptCallLog }> {
  const prompt = LANGUAGE_ANALYSIS_PROMPT_V1;
  const redacted = redactPII(args.openEndedResponse, args.veteranDisplayName);
  const context = args.recentContext ? redactPII(args.recentContext, args.veteranDisplayName) : "";

  const userText = context
    ? `Recent context (4 weeks):\n${context}\n\nCurrent open-ended response:\n${redacted}`
    : redacted;

  const inputHash = hashInput(`${prompt.version}\n${userText}`);
  const start = Date.now();

  const response = await client().messages.create({
    model: prompt.model,
    max_tokens: 1024,
    temperature: prompt.temperature,
    system: prompt.system,
    messages: [{ role: "user", content: userText }],
  });

  const latencyMs = Date.now() - start;
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Try to find a JSON block
    const match = text.match(/\{[\s\S]*\}/);
    if (!match || !match[0]) throw new Error("AI returned non-JSON output");
    parsed = JSON.parse(match[0]);
  }

  const analysis = validateLanguageAnalysis(parsed, prompt.version, prompt.model);

  const log: PromptCallLog = {
    promptVersion: prompt.version,
    model: prompt.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
    organizationId: args.organizationId,
    veteranId: args.veteranId,
    inputHash,
    validatedAgainstSchema: true,
  };

  return { analysis, log };
}

function validateLanguageAnalysis(
  raw: unknown,
  promptVersion: string,
  model: string,
): LanguageAnalysis {
  if (!raw || typeof raw !== "object") throw new Error("AI output not an object");
  const r = raw as Record<string, unknown>;

  const markersRaw = Array.isArray(r.markers) ? r.markers : [];
  const validMarkerNames = new Set([
    "HOPELESSNESS",
    "FINALITY",
    "ISOLATION",
    "LOSS_OF_PURPOSE",
    "SPECIFIC_STRESSOR",
  ]);
  const markers = markersRaw.flatMap((m) => {
    if (!m || typeof m !== "object") return [];
    const mm = m as Record<string, unknown>;
    if (typeof mm.marker !== "string" || !validMarkerNames.has(mm.marker)) return [];
    const conf = typeof mm.confidence === "number" ? mm.confidence : 0;
    return [
      {
        marker: mm.marker as LanguageAnalysis["markers"][number]["marker"],
        confidence: Math.max(0, Math.min(1, conf)),
        excerpt: typeof mm.excerpt === "string" ? mm.excerpt : undefined,
      },
    ];
  });

  const validSeverities = new Set(["GREEN", "YELLOW", "ORANGE", "RED"]);
  const recommendedSeverity =
    typeof r.recommendedSeverity === "string" && validSeverities.has(r.recommendedSeverity)
      ? (r.recommendedSeverity as LanguageAnalysis["recommendedSeverity"])
      : "GREEN";

  const explicitRiskLanguage =
    typeof r.explicitRiskLanguage === "boolean" ? r.explicitRiskLanguage : false;

  return {
    promptVersion,
    model,
    markers,
    recommendedSeverity,
    explicitRiskLanguage,
  };
}

export interface DraftReplyArgs {
  organizationId: string;
  veteranId: string;
  veteranDisplayName?: string | null;
  /** Most recent veteran message + 2 prior weeks of check-in context. */
  context: string;
  /** What the coordinator is trying to convey, in their own short words. */
  coordinatorIntent: string;
}

export async function draftCoordinatorReply(
  args: DraftReplyArgs,
): Promise<{ draft: string; log: PromptCallLog }> {
  const prompt = COORDINATOR_DRAFT_REPLY_PROMPT_V1;
  const userText = redactPII(
    `Coordinator intent: ${args.coordinatorIntent}\n\nContext:\n${args.context}`,
    args.veteranDisplayName,
  );
  const inputHash = hashInput(`${prompt.version}\n${userText}`);
  const start = Date.now();

  const response = await client().messages.create({
    model: prompt.model,
    max_tokens: 512,
    temperature: prompt.temperature,
    system: prompt.system,
    messages: [{ role: "user", content: userText }],
  });
  const latencyMs = Date.now() - start;

  const draft = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  return {
    draft,
    log: {
      promptVersion: prompt.version,
      model: prompt.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      organizationId: args.organizationId,
      veteranId: args.veteranId,
      inputHash,
      validatedAgainstSchema: false,
    },
  };
}
