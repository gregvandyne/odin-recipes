/**
 * Redact PII before sending to AI. Veteran's name → "the veteran".
 * This is conservative: when in doubt, redact.
 */
export function redactPII(text: string, veteranDisplayName: string | null | undefined): string {
  let out = text;
  if (veteranDisplayName) {
    const parts = veteranDisplayName.split(/\s+/).filter((p) => p.length >= 2);
    for (const p of parts) {
      const re = new RegExp(`\\b${escapeRegex(p)}\\b`, "gi");
      out = out.replace(re, "the veteran");
    }
  }
  // Phone numbers
  out = out.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]");
  // Email-shaped tokens
  out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]");
  // SSN-shaped
  out = out.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]");
  return out;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
