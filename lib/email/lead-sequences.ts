import "server-only";
import crypto from "node:crypto";
import { getSiteUrl } from "@/lib/brand";

export type CadenceStage =
  | null
  | "day_one_sent"
  | "day_three_sent"
  | "day_seven_sent"
  | "day_thirty_sent"
  | "year_one_sent";

export type SendParams = {
  to: string;
  firstName?: string | null;
  orgName: string;
  propertyName?: string | null;
  applyUrl: string;
  replyTo: string;
  leadId: string;
};


// ---------------------------------------------------------------------------
// Unsubscribe token helper. HMAC so we don't have to persist a token per
// lead. Truncated to 16 chars because the attack surface is "unsubscribe
// one person from one list" and a 16-char HMAC is ~64 bits of collision
// resistance, plenty for that.
// ---------------------------------------------------------------------------

export function unsubscribeToken(leadId: string): string {
  const secret = process.env.UNSUB_SECRET;
  if (!secret) {
    throw new Error("UNSUB_SECRET not configured");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(leadId)
    .digest("hex")
    .slice(0, 16);
}

export function verifyUnsubscribeToken(
  leadId: string,
  token: string
): boolean {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(unsubscribeToken(leadId)),
      Buffer.from(token)
    );
  } catch {
    return false;
  }
}

export function buildUnsubUrl(leadId: string): string {
  const base = getSiteUrl();
  const token = unsubscribeToken(leadId);
  return `${base}/unsub?lead=${leadId}&token=${token}`;
}
