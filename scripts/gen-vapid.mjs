/**
 * Generate VAPID key pair for Web Push. Run once, paste the values into
 * Vercel env vars (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY).
 */
import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY=", keys.publicKey);
console.log("VAPID_PRIVATE_KEY=", keys.privateKey);
console.log("VAPID_SUBJECT=mailto:security@platform.tld");
