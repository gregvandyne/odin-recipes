/**
 * Type definitions for the risk scoring engine.
 *
 * These are decoupled from Prisma so the engine can be tested in isolation
 * with synthetic fixtures.
 */

export const DOMAIN_CODES = [
  "SLEEP",
  "MOOD",
  "CONNECTION",
  "PURPOSE",
  "FINANCE",
  "SUBSTANCE",
  "PAIN",
  "RELATIONSHIP",
  "HOUSING",
] as const;

export type DomainCode = (typeof DOMAIN_CODES)[number];

export type ResponseType = "LIKERT_5" | "YES_NO" | "HOURS" | "OPEN_TEXT";

export type RiskLevel = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export type FlagType =
  | "TRAJECTORY_SHIFT"
  | "COMPOUNDING_RISK"
  | "LANGUAGE_MARKER"
  | "MISSED_CHECKIN"
  | "EXPLICIT_RISK";

export interface CheckInResponse {
  questionId: string;
  domainCode: DomainCode;
  responseType: ResponseType;
  /** For LIKERT_5: 1–5 (5 = most concerning). YES_NO: 0/1 (1 = concerning). HOURS: number. OPEN_TEXT: string. */
  value: number | string | null;
  /** True if veteran skipped. Skip is signal, not nothing. */
  skipped: boolean;
  /** Question weight (1.0 default). Heavier questions move domain scores more. */
  weight: number;
}

export interface CheckInRecord {
  id: string;
  weekNumber: number;
  submittedAt: Date;
  responses: CheckInResponse[];
  openEndedResponse: string | null;
}

export interface LanguageMarker {
  marker:
    | "HOPELESSNESS"
    | "FINALITY"
    | "ISOLATION"
    | "LOSS_OF_PURPOSE"
    | "SPECIFIC_STRESSOR";
  confidence: number; // 0–1
  excerpt?: string;
}

export interface LanguageAnalysis {
  promptVersion: string;
  model: string;
  markers: LanguageMarker[];
  /** AI's recommended severity floor — never lowers, only raises. */
  recommendedSeverity: RiskLevel;
  /** Raw text deemed explicit risk language; triggers EXPLICIT_RISK flag. */
  explicitRiskLanguage: boolean;
}

export interface DomainScore {
  domain: DomainCode;
  /** 0–100. Higher = more concerning. */
  score: number;
  /** Number of responses contributing. 0 means no signal this week. */
  responseCount: number;
  skippedCount: number;
}

export interface TrajectoryScore {
  domain: DomainCode;
  /** Difference vs. 4-week rolling baseline; positive = worsening. */
  shift4Week: number;
  /** Difference vs. 12-week rolling baseline. */
  shift12Week: number;
  /** True if this domain's shift exceeds the engine's trajectory threshold. */
  trajectoryShifted: boolean;
}

export interface RiskFlag {
  flagType: FlagType;
  severity: RiskLevel;
  explanation: string;
  domainsInvolved: DomainCode[];
}

export interface RiskScoreInput {
  current: CheckInRecord | null; // null when computing for a missed check-in
  /** Most recent first, up to 12 prior weeks. */
  history: CheckInRecord[];
  /** Hours since the check-in window opened, used for silence weighting. */
  hoursSinceCheckInWindowOpen: number;
  /** Number of consecutive missed weeks counting backward from now. */
  consecutiveMissedWeeks: number;
  /** Severity of most recent prior check-in (for silence weighting). */
  priorRiskLevel: RiskLevel | null;
  /** Optional pre-computed AI language analysis on `current.openEndedResponse`. */
  languageAnalysis: LanguageAnalysis | null;
}

export interface RiskScoreOutput {
  engineVersion: string;
  overallRiskLevel: RiskLevel;
  overallScore: number; // 0–100
  domainScores: DomainScore[];
  trajectories: TrajectoryScore[];
  flags: RiskFlag[];
  recommendedAction: string;
  recommendedTimeframeHours: number;
  escalateToClinicalLead: boolean;
  /** Human-readable summary. Coordinators see this. */
  explanation: string;
}
