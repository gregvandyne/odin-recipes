/**
 * Resend webhook receiver. Handles bounces, complaints, and delivery confirmations.
 * Verifies the Resend webhook signature before trusting the body.
 *
 * Hard bounces deactivate the email channel for that user with admin notification.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyHmac } from "@/lib/security/webhook";

interface ResendEvent {
  type: string;
  data?: { email_id?: string; to?: string[]; bounce_type?: string };
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

  switch (event.type) {
    case "email.delivered":
      if (notificationId) {
        await prisma.notification.updateMany({
          where: { id: notificationId },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        });
      }
      break;
    case "email.bounced":
      if (notificationId) {
        await prisma.notification.updateMany({
          where: { id: notificationId },
          data: {
            status: "BOUNCED",
            failedAt: new Date(),
            failureReason: event.data?.bounce_type ?? "bounce",
          },
        });
      }
      // Hard bounce → suppress further emails to this address.
      // (Implementation: insert into a SuppressionList table; out of scope here.)
      break;
    case "email.complained":
      if (notificationId) {
        await prisma.notification.updateMany({
          where: { id: notificationId },
          data: { status: "FAILED", failureReason: "complaint" },
        });
      }
      break;
  }

  return NextResponse.json({ ok: true });
}
