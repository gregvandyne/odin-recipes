/**
 * Severity → notification-category mapping + recipient targeting.
 *
 * The risk engine produces flag severities. The notification fan-out worker
 * needs to translate those into NotificationCategory values + a list of who
 * to alert. Centralized here so the check-ins route, the language-analysis
 * worker, and the SLA monitor all agree on the rules.
 */

import type { NotificationCategory } from "@prisma/client";
import type { RiskLevel } from "@/lib/risk/types";

export function categoryForSeverity(severity: RiskLevel): NotificationCategory | null {
  switch (severity) {
    case "RED":    return "RED_FLAG";
    case "ORANGE": return "ORANGE_FLAG";
    case "YELLOW": return "YELLOW_FLAG";
    case "GREEN":  return null;
  }
}

export type NotificationRecipient = "COORDINATOR" | "CLINICAL_LEAD" | "PROGRAM_MANAGER";

/**
 * Who should be alerted for a flag of this severity?
 *
 * - YELLOW: assigned coordinator only (routine awareness).
 * - ORANGE: assigned coordinator (24h SLA) + clinical lead in CC for context.
 * - RED:    assigned coordinator + clinical lead + program manager.
 *
 * Sub-roles (e.g. on-call clinical lead, OOO coverage) are resolved by the
 * notification worker against CoordinatorOOO and the clinical-lead pool.
 */
export function recipientsForSeverity(severity: RiskLevel): NotificationRecipient[] {
  switch (severity) {
    case "RED":    return ["COORDINATOR", "CLINICAL_LEAD", "PROGRAM_MANAGER"];
    case "ORANGE": return ["COORDINATOR", "CLINICAL_LEAD"];
    case "YELLOW": return ["COORDINATOR"];
    case "GREEN":  return [];
  }
}

/**
 * Categories that should also fan out via Web Push (in addition to email).
 * RED/ORANGE are user-perceived urgent; YELLOW is awareness only.
 */
export function pushEligible(category: NotificationCategory): boolean {
  return (
    category === "RED_FLAG" ||
    category === "ORANGE_FLAG" ||
    category === "NEW_ESCALATION" ||
    category === "NEW_MESSAGE"
  );
}

/**
 * Push priority for a category — controls TTL + vibrate behavior.
 */
export function pushPriorityFor(
  category: NotificationCategory,
): "low" | "normal" | "critical" {
  if (category === "RED_FLAG") return "critical";
  if (category === "ORANGE_FLAG" || category === "NEW_ESCALATION") return "normal";
  return "low";
}

/**
 * Categories that should publish to the per-tenant SSE pubsub channel so
 * the live triage queue/clinical queue refresh without a page reload.
 */
export function realtimeEligible(category: NotificationCategory): boolean {
  return (
    category === "RED_FLAG" ||
    category === "ORANGE_FLAG" ||
    category === "YELLOW_FLAG" ||
    category === "NEW_ESCALATION"
  );
}
