/**
 * Invitation token generation and verification.
 * Tokens are random 32-byte values. Only the SHA-256 hash is stored.
 * Single-use, expire in 7 days.
 */

import { createHash, randomBytes } from "node:crypto";

const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface InvitationToken {
  raw: string; // sent to recipient via email
  hash: string; // stored
  expiresAt: Date;
}

export function generateInvitationToken(): InvitationToken {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return {
    raw,
    hash,
    expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS),
  };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
