import "server-only";
import crypto from "node:crypto";
import { buildBaseHtml, getResend, isValidEmail } from "./shared";

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
// Automated lead nurture sequence. Day 1 → Day 3 → Day 7 → Day 30 → Year 1.
// Every email honors the unsubscribe link and writes its own send log via
// the caller (cron), not here. Copy is intentionally student-housing-leaning
// because that's the wedge vertical; we'll add subtype-aware variants once
// the other residential subtypes ship.
// ---------------------------------------------------------------------------

type SendResult = { ok: boolean; error?: string };

export async function sendLeadCadenceEmail(
  stage: "day_one" | "day_three" | "day_seven" | "day_thirty" | "year_one",
  p: SendParams
): Promise<SendResult> {
  if (!isValidEmail(p.to)) return { ok: false, error: "Invalid recipient" };
  const resend = getResend();
  if (!resend) return { ok: false, error: "Resend not configured" };

  const { subject, bodyHtml, ctaText } = RENDERERS[stage](p);

  const unsubUrl = buildUnsubUrl(p.leadId);
  const html = buildBaseHtml({
    headline: subject,
    bodyHtml,
    ctaText: ctaText ?? "Take another look",
    ctaUrl: p.applyUrl,
    includeUnsubscribe: true,
  });
  const htmlWithUnsub = html.replace(
    `/portal/settings`,
    unsubUrl.replace(/https?:\/\/[^/]+/, "")
  );

  try {
    await resend.emails.send({
      from: `${p.orgName} <${p.replyTo}>`,
      to: p.to,
      replyTo: p.replyTo,
      subject,
      html: htmlWithUnsub,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

type StageRender = (p: SendParams) => {
  subject: string;
  bodyHtml: string;
  ctaText?: string;
};

const RENDERERS: Record<
  "day_one" | "day_three" | "day_seven" | "day_thirty" | "year_one",
  StageRender
> = {
  day_one: (p) => ({
    subject: `Thanks for reaching out to ${esc(p.propertyName ?? p.orgName)}`,
    bodyHtml: intro(p) + `
      <p style="margin:0 0 12px;">Here are a few ways I can help right now:</p>
      <ul style="margin:0 0 16px 18px;padding:0;">
        <li style="margin-bottom:6px;">Browse floor plans and live availability</li>
        <li style="margin-bottom:6px;">Schedule a tour (in-person or virtual)</li>
        <li style="margin-bottom:6px;">Reply with questions, a real person answers every reply</li>
      </ul>
      <p style="margin:0 0 12px;">Looking forward to meeting you.</p>`,
    ctaText: "Start your application",
  }),
  day_three: (p) => ({
    subject: `Still thinking about ${esc(p.propertyName ?? p.orgName)}?`,
    bodyHtml: intro(p) + `
      <p style="margin:0 0 12px;">Checking in: anything we can clarify about units, pricing, or move-in timing?</p>
      <p style="margin:0 0 12px;">Three things people usually ask:</p>
      <ul style="margin:0 0 16px 18px;padding:0;">
        <li style="margin-bottom:6px;">Lease terms and what's included</li>
        <li style="margin-bottom:6px;">Application process and timeline</li>
        <li style="margin-bottom:6px;">Neighborhood, campus/commute distances</li>
      </ul>`,
    ctaText: "Take a closer look",
  }),
  day_seven: (p) => ({
    subject: `Quick check-in, was the timing off?`,
    bodyHtml: intro(p) + `
      <p style="margin:0 0 12px;">Haven't heard back, which usually means timing or a question we didn't answer.</p>
      <p style="margin:0 0 12px;">Happy to hold a tour spot, or walk through options over a quick call. Just reply with what works.</p>`,
    ctaText: "See what's available",
  }),
  day_thirty: (p) => ({
    subject: `${esc(p.propertyName ?? p.orgName)}, still looking?`,
    bodyHtml: intro(p) + `
      <p style="margin:0 0 12px;">Units are filling up for the next lease term. If you're still in the market, this is the right moment to lock in.</p>
      <p style="margin:0 0 12px;">Reply and I'll send you the current availability list, plus any incentives we're running.</p>`,
    ctaText: "View availability",
  }),
  year_one: (p) => ({
    subject: `Leasing for next year at ${esc(p.propertyName ?? p.orgName)} just opened`,
    bodyHtml: intro(p) + `
      <p style="margin:0 0 12px;">Wanted to reach back out, we just opened leasing for the next academic year.</p>
      <p style="margin:0 0 12px;">You'd get first pick of the best-laid-out rooms if you'd like to lock in a tour this week.</p>`,
    ctaText: "Lock in a tour",
  }),
};

function intro(p: SendParams): string {
  const greeting = p.firstName?.trim()
    ? `Hi ${esc(p.firstName.trim())},`
    : "Hi,";
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">${greeting}</p>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const token = unsubscribeToken(leadId);
  return `${base}/unsub?lead=${leadId}&token=${token}`;
}
