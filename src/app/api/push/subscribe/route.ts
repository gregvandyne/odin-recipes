/**
 * POST /api/push/subscribe — register a Web Push subscription.
 *
 * The browser provides {endpoint, keys: {p256dh, auth}}. We store these per
 * user. Multiple subscriptions per user are allowed (phone + laptop).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withAuth } from "@/lib/security/api-auth";

const Body = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});

export const POST = withAuth(
  async (req, ctx) => {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const { endpoint, keys } = parsed.data;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: ctx.userAgent.slice(0, 256),
      },
      update: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        revokedAt: null,
        lastSeenAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  },
  { rateLimit: "api.push", requireOrganization: false },
);

export const DELETE = withAuth(
  async (req) => {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    await prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { revokedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  },
  { rateLimit: "api.push", requireOrganization: false },
);
