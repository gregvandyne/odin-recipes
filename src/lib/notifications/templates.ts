/**
 * Render-side notification template selector.
 *
 * Maps a NotificationCategory to a concrete React Email template + plain-text
 * fallback. The notification worker calls `renderNotificationEmail` with the
 * stored bodyTemplateId and recipient context; we keep the actual template
 * components out of the worker file so the worker can import safely without
 * pulling React Email's render path on cold start unless it actually has a
 * job to dispatch.
 */

import { render } from "@react-email/render";
import * as React from "react";
import type { NotificationCategory } from "@prisma/client";
import { FlagAlertEmail } from "@/lib/email/templates/flag-alert";
import { CheckInInviteEmail } from "@/lib/email/templates/check-in-invite";

export interface RenderArgs {
  category: NotificationCategory;
  displayName: string | null;
  relatedResourceType: string | null;
  relatedResourceId: string | null;
}

export function subjectFor(category: NotificationCategory): string {
  switch (category) {
    case "RED_FLAG":            return "Sentinel: a veteran needs immediate attention";
    case "ORANGE_FLAG":         return "Sentinel: outreach needed within 24h";
    case "YELLOW_FLAG":         return "Sentinel: new caseload signal";
    case "NEW_ESCALATION":      return "Sentinel: case escalated to clinical";
    case "NEW_MESSAGE":         return "Sentinel: new message from a veteran";
    case "WEEKLY_CHECKIN_INVITE":return "Your weekly check-in is ready";
    case "MISSED_CHECKIN_NUDGE":return "Just checking in";
    case "COORDINATOR_OUTREACH":return "Your coordinator reached out";
    case "RESOURCE_HIGHLIGHT":  return "A resource that might help";
    case "PROGRAM_MILESTONE":   return "You reached a milestone";
    case "ACCOUNT_SECURITY":    return "Sentinel: account security";
    case "CASELOAD_DIGEST":     return "Sentinel: today's caseload";
    case "NEW_VETERAN_ASSIGNED":return "Sentinel: new veteran assigned";
    case "CLINICAL_DAILY_DIGEST":return "Sentinel: clinical daily digest";
    case "COHORT_SUMMARY":      return "Sentinel: cohort summary";
    case "CASELOAD_HEALTH_ALERT":return "Sentinel: caseload health";
    case "INVITATION_ACCEPTED_NOTICE":return "Sentinel: invitation accepted";
    case "BILLING_NOTICE":      return "Sentinel: billing";
  }
}

export async function renderNotificationEmail(args: RenderArgs): Promise<{ html: string; text: string }> {
  switch (args.category) {
    case "RED_FLAG":
    case "ORANGE_FLAG": {
      const severity = args.category === "RED_FLAG" ? "RED" : "ORANGE";
      const caseUrl = args.relatedResourceId
        ? `/coordinator/veteran/${args.relatedResourceId}`
        : "/coordinator";
      const html = await render(
        React.createElement(FlagAlertEmail, {
          coordinatorName: args.displayName ?? "Coordinator",
          veteranName: "A veteran in your caseload",
          severity,
          explanation:
            severity === "RED"
              ? "Patterns indicate immediate concern. Open the case to see what was flagged and the recommended action."
              : "A pattern shifted enough to warrant outreach within 24 hours. Open the case for details.",
          recommendedTimeframe: severity === "RED" ? "1 hour" : "24 hours",
          caseUrl,
        }),
      );
      const text =
        severity === "RED"
          ? `Immediate attention required for a veteran in your caseload. Open ${caseUrl}.`
          : `Outreach needed within 24 hours. Open ${caseUrl}.`;
      return { html, text };
    }

    case "YELLOW_FLAG": {
      const caseUrl = args.relatedResourceId
        ? `/coordinator/veteran/${args.relatedResourceId}`
        : "/coordinator";
      const html = await render(
        React.createElement(FlagAlertEmail, {
          coordinatorName: args.displayName ?? "Coordinator",
          veteranName: "A veteran in your caseload",
          severity: "ORANGE",
          explanation: "Awareness signal. Review when convenient.",
          recommendedTimeframe: "48 hours",
          caseUrl,
        }),
      );
      return {
        html,
        text: `New signal in your caseload. Open ${caseUrl}.`,
      };
    }

    case "NEW_ESCALATION": {
      const url = args.relatedResourceId ? `/clinical?escalation=${args.relatedResourceId}` : "/clinical";
      const html = await render(
        React.createElement(FlagAlertEmail, {
          coordinatorName: args.displayName ?? "Clinician",
          veteranName: "A coordinator's case",
          severity: "RED",
          explanation: "A coordinator has escalated a case to clinical review.",
          recommendedTimeframe: "Immediate review",
          caseUrl: url,
        }),
      );
      return { html, text: `Escalation queued. Open ${url}.` };
    }

    case "NEW_MESSAGE": {
      const url = args.relatedResourceId ? `/coordinator/messages/${args.relatedResourceId}` : "/coordinator/messages";
      const html = await render(
        React.createElement(FlagAlertEmail, {
          coordinatorName: args.displayName ?? "Coordinator",
          veteranName: "A veteran",
          severity: "ORANGE",
          explanation: "A veteran has sent a message.",
          recommendedTimeframe: "Same day",
          caseUrl: url,
        }),
      );
      return { html, text: `New message. Open ${url}.` };
    }

    case "WEEKLY_CHECKIN_INVITE": {
      const html = await render(
        React.createElement(CheckInInviteEmail, {
          veteranName: args.displayName?.split(" ")[0] ?? "there",
          weekNumber: 0, // worker doesn't have program context here; templates can show an empty/optional week
          url: "/v/check-in",
        }),
      );
      return {
        html,
        text: `Your weekly check-in is ready. Open /v/check-in.`,
      };
    }

    default: {
      // Generic fallback — bare HTML so we never throw on unknown categories.
      const subject = subjectFor(args.category);
      const html = `<!doctype html><html><body><p>${subject}</p></body></html>`;
      return { html, text: subject };
    }
  }
}
