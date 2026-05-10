/**
 * Password handling. Aligned to NIST SP 800-63B:
 *  - 12-character minimum
 *  - No composition rules
 *  - Checked against HIBP (Have I Been Pwned) on creation and reset
 *  - No forced rotation
 *  - Argon2id for storage (via @node-rs/argon2 — pure Rust, prebuilt for Vercel)
 */

import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

// Argon2id literal — matches @node-rs/argon2's Algorithm.Argon2id enum value.
// Imported as a literal because TypeScript's isolatedModules forbids referencing
// ambient const enums.
const ARGON2ID = 2 as const;
import { createHash } from "node:crypto";

export const PASSWORD_MIN_LENGTH = 12;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < PASSWORD_MIN_LENGTH) {
    throw new Error("password too short");
  }
  return argonHash(plain, { algorithm: ARGON2ID });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argonVerify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * HIBP "k-anonymity" range API — never sends the full hash.
 * Returns true if the password has been seen in a known breach.
 */
export async function checkHibpBreach(plain: string): Promise<boolean> {
  const sha = createHash("sha1").update(plain).digest("hex").toUpperCase();
  const prefix = sha.slice(0, 5);
  const suffix = sha.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    // Fail-closed only in production; fail-open in development to avoid
    // local environment friction. The check is defense-in-depth, not the
    // sole gate.
    return process.env.NODE_ENV === "production";
  }
  const text = await res.text();
  for (const line of text.split("\n")) {
    const [hashSuffix] = line.trim().split(":");
    if (hashSuffix === suffix) return true;
  }
  return false;
}
