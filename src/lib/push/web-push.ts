/**
 * Web Push (VAPID) helper.
 *
 * Generate VAPID keys once via `node scripts/gen-vapid.mjs` (committed) and
 * store the values in env vars. The public key is exposed to the client for
 * subscription; the private key stays server-side and signs each push.
 *
 * Per the design system: non-critical pushes are silent and use no vibrate;
 * RED-priority pushes use a single short vibrate. Veterans never see
 * notification badge counts (the SW does not request them).
 */

import webPush, { type PushSubscription as WebPushSubscription } from "web-push";

let _configured = false;
function configure(): boolean {
  if (_configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT ?? "mailto:security@platform.tld";
  if (!pub || !priv) return false;
  webPush.setVapidDetails(subj, pub, priv);
  _configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  priority?: "low" | "normal" | "critical";
}

export async function sendPush(
  subscription: WebPushSubscription,
  payload: PushPayload,
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  if (!configure()) {
    return { ok: false, error: "VAPID not configured" };
  }
  try {
    const res = await webPush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: payload.priority === "critical" ? 60 : 60 * 60 * 4,
      urgency: payload.priority === "critical" ? "high" : "normal",
    });
    return { ok: true, statusCode: res.statusCode };
  } catch (err) {
    const e = err as { statusCode?: number; body?: string; message?: string };
    return { ok: false, statusCode: e.statusCode, error: e.body ?? e.message };
  }
}

export function publicVapidKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}
