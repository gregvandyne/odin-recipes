/**
 * Open-redirect guard.
 *
 * Any user-supplied `next` / `callbackUrl` parameter must resolve to a
 * same-origin path. We never trust the raw value because an attacker can
 * craft a sign-in URL like `?next=https://evil.example/page` and a
 * successful sign-in handler would happily 302 there.
 *
 * Rules:
 *   - Must start with `/` (path-only).
 *   - Must NOT start with `//` or `/\` (protocol-relative URLs).
 *   - Must NOT contain `\` or whitespace.
 *   - Length capped to 1024 chars.
 *   - Falls back to the supplied `defaultPath` (default `/`).
 *
 * Returns the validated path or the fallback. Never throws.
 */

const MAX_LEN = 1024;
const SAFE_PATH_RE = /^\/(?!\/)(?!\\)[^\s\\]*$/;

export function safeNextPath(input: unknown, defaultPath: string = "/"): string {
  if (typeof input !== "string") return defaultPath;
  if (input.length === 0 || input.length > MAX_LEN) return defaultPath;
  // Strict allow-list: starts with /, no leading // or /\, no backslash or
  // whitespace anywhere. Encoded equivalents (%2f%2f, %5c) are rejected by
  // decoding first.
  let decoded: string;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    return defaultPath;
  }
  if (!SAFE_PATH_RE.test(input) || !SAFE_PATH_RE.test(decoded)) return defaultPath;
  return input;
}
