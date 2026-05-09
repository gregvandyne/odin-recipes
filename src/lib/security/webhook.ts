/**
 * Generic webhook signature verification.
 *
 * For Resend / SES / Postmark / Twilio etc. — every external webhook must be
 * verified before its body is trusted. Constant-time comparison.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifyOpts {
  /** Raw request body as a string, exactly as received. */
  body: string;
  /** Header value carrying the signature. */
  signature: string;
  /** Shared secret. */
  secret: string;
  /** Hash algorithm. */
  algo?: "sha256" | "sha512";
  /** Optional encoding for the signature (default hex). */
  encoding?: "hex" | "base64";
}

export function verifyHmac(opts: VerifyOpts): boolean {
  const algo = opts.algo ?? "sha256";
  const encoding = opts.encoding ?? "hex";
  const expected = createHmac(algo, opts.secret).update(opts.body, "utf8").digest(encoding);
  const a = Buffer.from(expected);
  const b = Buffer.from(opts.signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
