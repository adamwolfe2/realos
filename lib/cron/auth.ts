import { NextResponse } from "next/server";
import crypto from "node:crypto";

/**
 * Validates a Bearer CRON_SECRET header in constant time.
 * Returns null on success, or a NextResponse to return on auth failure.
 *
 * Usage at the top of every cron route:
 *   const authError = verifyCronAuth(req);
 *   if (authError) return authError;
 */
export function verifyCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  // Pad to equal length to avoid length-leak via timingSafeEqual throwing.
  // We compute over a fixed-size buffer so unequal lengths still get
  // constant-time comparison (returning false rather than early-exit).
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  const max = Math.max(a.length, b.length);
  const aPad = Buffer.alloc(max);
  const bPad = Buffer.alloc(max);
  a.copy(aPad);
  b.copy(bPad);
  const equal = crypto.timingSafeEqual(aPad, bPad) && a.length === b.length;
  if (!equal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
