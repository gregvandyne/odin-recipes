/**
 * Email sender. Resend in production; logs-only in development if no API key.
 *
 * Every send is logged to the Notification table. Bounces and complaints
 * arrive via webhooks and are dispatched to /api/webhooks/resend.
 *
 * Per-recipient rate limiting is enforced separately (see rate-limit.ts).
 */

import { render } from "@react-email/render";
import { Resend } from "resend";
import { prisma } from "@/lib/db/prisma";
import type { NotificationCategory } from "@prisma/client";

let _resend: Resend | null = null;
function client(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

export interface SendOpts {
  organizationId: string | null;
  to: string;
  recipientUserId: string;
  category: NotificationCategory;
  subject: string;
  template: React.ReactElement;
  /** Distinct from category — for the bodyTemplateId column. */
  templateId: string;
  /** Plain text fallback (deliverability + accessibility). */
  text: string;
  relatedResource?: { type: string; id: string };
}

export async function sendEmail(opts: SendOpts): Promise<{ id: string; sent: boolean }> {
  const html = await render(opts.template);
  const fromPlatform = process.env.EMAIL_FROM_PLATFORM ?? "Sentinel <noreply@platform.tld>";
  const fromProgram  = process.env.EMAIL_FROM_PROGRAM  ?? fromPlatform;
  const isSecurity = ["ACCOUNT_SECURITY"].includes(opts.category);
  const from = isSecurity ? fromPlatform : fromProgram;

  // Persist the notification record up front so we can correlate webhook bounces.
  const record = await prisma.notification.create({
    data: {
      organizationId: opts.organizationId,
      recipientUserId: opts.recipientUserId,
      category: opts.category,
      channel: "EMAIL",
      subject: opts.subject,
      bodyTemplateId: opts.templateId,
      relatedResourceType: opts.relatedResource?.type,
      relatedResourceId: opts.relatedResource?.id,
      status: "QUEUED",
    },
  });

  const r = client();
  if (!r) {
    // Dev mode: log and mark suppressed — easier than failing the flow.
    console.log(`[email DEV] to=${opts.to} subject="${opts.subject}" template=${opts.templateId}`);
    await prisma.notification.update({
      where: { id: record.id },
      data: { status: "SUPPRESSED", failedAt: new Date(), failureReason: "RESEND_API_KEY not set (dev mode)" },
    });
    return { id: record.id, sent: false };
  }

  try {
    await r.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html,
      text: opts.text,
      headers: {
        "X-Notification-Id": record.id,
        "X-Notification-Category": opts.category,
      },
    });
    await prisma.notification.update({
      where: { id: record.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { id: record.id, sent: true };
  } catch (err) {
    await prisma.notification.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: err instanceof Error ? err.message : "unknown error",
      },
    });
    return { id: record.id, sent: false };
  }
}
