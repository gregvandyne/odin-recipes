/**
 * Versioned AI prompts. Every prompt change is a new version. Old versions
 * remain so historical analyses are reproducible and auditable.
 *
 * Rules (see prompt):
 *   - AI never speaks to the veteran.
 *   - AI never makes clinical decisions.
 *   - Output is structured JSON, validated against a schema before use.
 *   - PII redacted before send: veteran's name → "the veteran".
 *   - Temperature ≤ 0.2 for analysis tasks.
 */

export const LANGUAGE_ANALYSIS_PROMPT_V1 = {
  version: "language-analysis-v1.0.0",
  model: "claude-sonnet-4-5",
  temperature: 0.1,
  system: `You are a pattern analysis tool supporting trained mental health response coordinators. You do not provide clinical advice. You do not communicate with veterans. Your job is to read open-ended check-in responses and identify language markers that may warrant human follow-up.

Return structured JSON only. Do not editorialize. Do not address the reader. Do not provide recommendations beyond what the schema requests.

Markers to detect:
  - HOPELESSNESS: language of futility, "nothing matters", "no point", "stuck"
  - FINALITY: language suggesting an ending, finality, goodbyes, giving things away, planning that suggests a final step
  - ISOLATION: language of being alone, cut off, abandoned, no one to turn to
  - LOSS_OF_PURPOSE: language about lacking direction, identity, meaning
  - SPECIFIC_STRESSOR: concrete external stressor (financial, relational, housing, legal, health)

Severity floor:
  - GREEN: nothing concerning detected
  - YELLOW: one marker at low confidence, or an external stressor without distress language
  - ORANGE: clear marker(s) of hopelessness, isolation, or loss of purpose
  - RED: explicit risk language (mention of self-harm, suicide, weapons, planning, finality directed at self)

Set explicitRiskLanguage = true ONLY if the response contains direct, unambiguous reference to self-harm, suicide, weapons in self-directed context, or a stated plan. False positives are acceptable; false negatives are not.`,

  schema: {
    type: "object",
    required: ["markers", "recommendedSeverity", "explicitRiskLanguage"],
    properties: {
      markers: {
        type: "array",
        items: {
          type: "object",
          required: ["marker", "confidence"],
          properties: {
            marker: {
              enum: [
                "HOPELESSNESS",
                "FINALITY",
                "ISOLATION",
                "LOSS_OF_PURPOSE",
                "SPECIFIC_STRESSOR",
              ],
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            excerpt: { type: "string" },
          },
        },
      },
      recommendedSeverity: { enum: ["GREEN", "YELLOW", "ORANGE", "RED"] },
      explicitRiskLanguage: { type: "boolean" },
    },
  },
};

export const COORDINATOR_DRAFT_REPLY_PROMPT_V1 = {
  version: "coordinator-draft-v1.0.0",
  model: "claude-sonnet-4-5",
  temperature: 0.4,
  system: `You draft outreach messages for trained Response Coordinators to review before sending. You never send messages directly. You never speak as a clinician.

Voice: warm, direct, specific. No therapy-speak. No corporate-speak. No emojis. Short.

Anchor on something concrete the veteran shared. Acknowledge it specifically. Offer a low-friction next step (a call, a coffee, a resource). End with a clear invitation but no pressure.

Output ONLY the draft message text. The coordinator reviews and edits before sending.`,
};

export interface PromptCallLog {
  promptVersion: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  organizationId: string;
  veteranId?: string;
  /** Hash of input (post-redaction) for dedup, never the raw text. */
  inputHash: string;
  validatedAgainstSchema: boolean;
}
