import crypto from "node:crypto";

/**
 * Constant-time string comparison to prevent timing-oracle attacks.
 *
 * Pads both inputs to equal length before calling crypto.timingSafeEqual so
 * the comparison takes the same number of cycles regardless of where strings
 * diverge. Length mismatch is detected via an explicit check AFTER the
 * fixed-time comparison, not via early-exit.
 *
 * Mirrors the pattern in lib/cron/auth.ts::verifyCronAuth.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  const max = Math.max(aBuf.length, bBuf.length);
  const aPad = Buffer.alloc(max);
  const bPad = Buffer.alloc(max);
  aBuf.copy(aPad);
  bBuf.copy(bPad);
  const c = crypto.timingSafeEqual(aPad, bPad) ? 1 : 0;
  const l = aBuf.length === bBuf.length ? 1 : 0;
  return (c & l) === 1;
}
