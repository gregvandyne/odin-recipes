/**
 * Field-level encryption for PHI/PII at rest.
 *
 * AES-256-GCM with a 32-byte master key supplied via APP_ENCRYPTION_KEY
 * (base64). Each ciphertext carries its own random nonce and an
 * authenticated context tag so decryption fails loudly on tampering.
 *
 * Key rotation: ciphertext is prefixed with a key id (`v1`, `v2`, ...).
 * Multiple keys can be configured at once during a rotation window;
 * decryption tries the matching key id, encryption uses the active key.
 *
 * What we encrypt with this:
 *   - CheckIn.openEndedResponse
 *   - Message.bodyEncrypted
 *   - Contact.summary
 *   - ClinicalEscalation.consultNotes
 *
 * What we DON'T encrypt at the field level: anything we need to query on
 * (riskLevel, severity, etc.). Postgres at-rest disk encryption is the
 * second layer; field-level is the first.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const ACTIVE_VERSION_ENV = "APP_ENCRYPTION_KEY_VERSION";
const KEY_ENV_PREFIX = "APP_ENCRYPTION_KEY_"; // e.g. APP_ENCRYPTION_KEY_V1

interface Keyring {
  active: string;
  keys: Map<string, Buffer>;
}

let _keyring: Keyring | null = null;

function loadKeyring(): Keyring {
  if (_keyring) return _keyring;
  const keys = new Map<string, Buffer>();
  // Legacy single-key path (APP_ENCRYPTION_KEY).
  const legacy = process.env.APP_ENCRYPTION_KEY;
  if (legacy) {
    const buf = Buffer.from(legacy, "base64");
    if (buf.length !== KEY_BYTES) {
      throw new Error(`APP_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (base64-encoded)`);
    }
    keys.set("v1", buf);
  }
  // Versioned keys (APP_ENCRYPTION_KEY_V1, V2, ...).
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith(KEY_ENV_PREFIX) || !v) continue;
    const id = k.slice(KEY_ENV_PREFIX.length).toLowerCase();
    const buf = Buffer.from(v, "base64");
    if (buf.length !== KEY_BYTES) continue;
    keys.set(id, buf);
  }
  if (keys.size === 0) {
    throw new Error(
      "No encryption keys configured. Set APP_ENCRYPTION_KEY (base64-encoded 32 bytes).",
    );
  }
  const active = process.env[ACTIVE_VERSION_ENV]?.toLowerCase() ?? "v1";
  if (!keys.has(active)) {
    throw new Error(`Active key version "${active}" not found in keyring`);
  }
  _keyring = { active, keys };
  return _keyring;
}

/**
 * Encrypt a string. Returns `<version>:<base64-nonce>:<base64-ciphertext>:<base64-tag>`.
 * `aad` is bound into the auth tag so decryption fails if the row is moved
 * to a different context (e.g., a different organization or veteran).
 */
export function encryptField(plain: string, aad: string): string {
  const ring = loadKeyring();
  const key = ring.keys.get(ring.active)!;
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, key, nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ring.active}:${nonce.toString("base64")}:${ct.toString("base64")}:${tag.toString("base64")}`;
}

export function decryptField(envelope: string, aad: string): string {
  const ring = loadKeyring();
  const parts = envelope.split(":");
  if (parts.length !== 4) throw new Error("malformed ciphertext envelope");
  const [version, nonceB64, ctB64, tagB64] = parts as [string, string, string, string];
  const key = ring.keys.get(version);
  if (!key) throw new Error(`unknown key version: ${version}`);
  const nonce = Buffer.from(nonceB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv(ALGO, key, nonce, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Constant-time string compare. Used for token/secret comparison where
 * `===` would leak information via timing.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** Helper: build AAD for a check-in's open-ended response. */
export function checkInAad(organizationId: string, veteranId: string, checkInId: string): string {
  return `org=${organizationId};vet=${veteranId};ci=${checkInId};field=openEndedResponse`;
}

export function messageAad(organizationId: string, threadId: string, messageId: string): string {
  return `org=${organizationId};thr=${threadId};msg=${messageId};field=body`;
}

export function contactAad(organizationId: string, contactId: string): string {
  return `org=${organizationId};contact=${contactId};field=summary`;
}
