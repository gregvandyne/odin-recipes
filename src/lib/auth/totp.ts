/**
 * TOTP — RFC 6238 / HOTP RFC 4226.
 *
 * Pure-Node implementation so we don't pull a fresh dependency for this. Used
 * for staff MFA. Compatible with Google Authenticator, 1Password, Authy, etc.
 *
 * The secret is encoded base32 (RFC 3548) for the otpauth:// URL the QR code
 * displays. We store the raw bytes encrypted via AES-GCM (encryptField with
 * AAD `mfa-secret:${userId}`).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const DRIFT_WINDOWS = 1; // accept ±1 step (≈ ±30s clock skew)

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateSecret(byteLength = 20): Buffer {
  return randomBytes(byteLength);
}

export function toBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  // Padding to a multiple of 8 — Authenticator apps tolerate either.
  while (out.length % 8 !== 0) out += "=";
  return out;
}

export function fromBase32(input: string): Buffer {
  const cleaned = input.replace(/=+$/g, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(c);
    if (idx < 0) throw new Error("invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function otpauthUrl(args: {
  issuer: string;
  account: string;
  secret: Buffer;
}): string {
  const secret = toBase32(args.secret).replace(/=+$/g, "");
  const params = new URLSearchParams({
    secret,
    issuer: args.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  const label = `${encodeURIComponent(args.issuer)}:${encodeURIComponent(args.account)}`;
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function totpCode(secret: Buffer, atUnixSeconds: number = Math.floor(Date.now() / 1000)): string {
  const counter = Math.floor(atUnixSeconds / STEP_SECONDS);
  return hotpCode(secret, counter);
}

function hotpCode(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = createHmac("sha1", secret).update(buf).digest();
  // Dynamic-truncation per RFC 4226.
  const lastByte = hmac[hmac.length - 1];
  if (lastByte === undefined) throw new Error("hmac empty");
  const offset = lastByte & 0xf;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const mod = code % 10 ** DIGITS;
  return mod.toString().padStart(DIGITS, "0");
}

/**
 * Verify a user-supplied 6-digit code against the secret. Accepts ±1 step
 * of drift to tolerate a small clock skew. Constant-time string compare.
 */
export function verifyTotp(secret: Buffer, supplied: string): boolean {
  const cleaned = supplied.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const now = Math.floor(Date.now() / 1000);
  for (let drift = -DRIFT_WINDOWS; drift <= DRIFT_WINDOWS; drift++) {
    const expected = totpCode(secret, now + drift * STEP_SECONDS);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(cleaned, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/**
 * Generate a set of recovery codes. Each is shown once at setup; we hash
 * them (SHA-256) before storing. They're single-use.
 */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const b = randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${b.slice(0, 5)}-${b.slice(5, 10)}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  // SHA-256 hex; recovery codes are high-entropy, no peppering needed.
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(code.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase()).digest("hex");
}
