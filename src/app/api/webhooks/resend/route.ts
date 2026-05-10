/**
 * Resend webhook receiver. Handles bounces, complaints, and delivery confirmations.
 * Verifies the Resend webhook signature before trusting the body.
 *
 * Hard bounces and complaints add the recipient to the SuppressionList so
 * future outbound emails to that address are short-circuited at send time.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyHmac } from "@/lib/security/webhook";
import { suppressEmail } from "@/lib/email/suppression";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { logger } from "@/lib/logging/log";

interface ResendEvent {
  type: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce_type?: string;
    bounce?: { type?: string };
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const signature = req.headers.get("svix-signature") ?? req.headers.get("resend-signature") ?? "";
  const body = await req.text();

  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  if (!verifyHmac({ body, signature, secret })) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body) as ResendEvent;
  const notificationId = event.data?.email_id;
  const recipientList = event.data?.to ?? [];
  const recipient = recipientList[0];

  switch (event.type) {
    case "email.delivered":
      if (notificationId) {
        await prisma.notification.updateMany({
          where: { id: notificationId },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        });
      }
      break;

    case "email.bounced": {
      const bounceType = event.data?.bounce_type ?? event.data?.bounce?.type ?? "bounce";
      if (notificationId) {
        await prisma.notification.updateMany({
          where: { id: notificationId },
          data: {
            status: "BOUNCED",
            failedAt: new Date(),
            failureReason: bounceType,
          },
        });
      }
      // Only hard bounces are permanently suppressed. Soft bounces are
      // transient (mailbox full, etc.) and we let the next attempt try again.
      const isHard = /hard|permanent|invalid|nonexistent|user_unknown/i.test(bounceType);
      if (recipient && isHard) {
        await suppressEmail(recipient, "HARD_BOUNCE", {
          notificationId,
          bounceType,
          source: "resend.webhook",
        });
        await logAudit({
          organizationId: null,
          actorId: null,
          actorRole: "SYSTEM",
          action: AUDIT_ACTIONS.EMAIL_SUPPRESSED,
          resourceType: "SuppressionList",
          resourceId: recipient.toLowerCase(),
          metadata: { reason: "HARD_BOUNCE", bounceType, notificationId },
        });
        logger.warn(
          { recipient, bounceType, notificationId },
          "email hard bounce — recipient suppressed",
        );
      }
      break;
    }

    case "email.complained":
      if (notificationId) {
        await prisma.notification.updateMany({
          where: { id: notificationId },
          data: { status: "FAILED", failureReason: "complaint" },
        });
      }
      if (recipient) {
        await suppressEmail(recipient, "COMPLAINT", {
          notificationId,
          source: "resend.webhook",
        });
        await logAudit({
          organizationId: null,
          actorId: null,
          actorRole: "SYSTEM",
          action: AUDIT_ACTIONS.EMAIL_SUPPRESSED,
          resourceType: "SuppressionList",
          resourceId: recipient.toLowerCase(),
          metadata: { reason: "COMPLAINT", notificationId },
        });
      }
      break;
  }

  return NextResponse.json({ ok: true });
}
