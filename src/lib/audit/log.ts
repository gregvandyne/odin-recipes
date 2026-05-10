/**
 * Append-only audit log helpers.
 *
 * Every read of another user's data should be logged with a reason.
 * Every write to clinical data should be logged with the actor.
 *
 * The AuditLog table is enforced as append-only at the database level via
 * triggers (see migration 0001). Even a buggy app cannot mutate or delete.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface AuditEntry {
  organizationId: string | null;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(
  entry: AuditEntry,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  const metadata: Record<string, unknown> = { ...(entry.metadata ?? {}) };
  if (entry.correlationId) metadata.correlationId = entry.correlationId;
  await client.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      reason: entry.reason,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export const AUDIT_ACTIONS = {
  CHECKIN_SUBMIT: "checkin.submit",
  CHECKIN_REVIEW: "checkin.review",
  CHECKIN_DRAFT_SAVE: "checkin.draft.save",
  CHECKIN_DRAFT_DISCARD: "checkin.draft.discard",
  CHECKIN_FEEDBACK: "checkin.feedback",
  FLAG_ACK: "flag.acknowledge",
  FLAG_RESOLVE: "flag.resolve",
  FLAG_OVERRIDE: "flag.severity_override",
  CONTACT_LOG: "contact.log",
  CONTACT_EDIT: "contact.edit",
  MESSAGE_SEND: "message.send",
  MESSAGE_READ: "message.read",
  ESCALATION_RAISE: "escalation.raise",
  ESCALATION_CLOSE: "escalation.close",
  USER_INVITE: "user.invite",
  USER_DEACTIVATE: "user.deactivate",
  USER_REACTIVATE: "user.reactivate",
  CASELOAD_REASSIGN: "caseload.reassign",
  CONSENT_SIGN: "consent.sign",
  ORG_PROVISION: "org.provision",
  ORG_GRADUATE: "org.graduate_to_production",
  ORG_SUSPEND: "org.suspend",
  AI_CALL: "ai.call",
  EXPORT_REQUEST: "export.request",
  ELEVATED_ACCESS: "platform.elevated_access",
  INVITE_DISPATCH: "notification.invite.dispatch",
  PUSH_SUBSCRIBE: "push.subscribe",
  CRON_TRIGGER: "cron.trigger",
} as const;
