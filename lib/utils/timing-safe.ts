/**
 * Timing-safe equality helper.
 *
 * `crypto.timingSafeEqual(a, b)` throws RangeError when the two buffers
 * have different lengths — that throw bubbles to a 500 response AND leaks
 * "your input wasn't the expected length" signal to an attacker probing
 * a signature/token compare. `safeEqual` length-checks first (length is
 * not the secret), returns false on mismatch, and only calls into the
 * constant-time compare when lengths match.
 *
 * Use this anywhere you'd reach for `timingSafeEqual` to compare an
 * untrusted input against a known-good value (HMAC signatures, signed
 * cookies, OAuth state, webhook tokens, etc.).
 */

import crypto from "node:crypto";

export function safeEqual(a: string | Buffer, b: string | Buffer): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}
