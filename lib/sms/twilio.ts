import "server-only";

// ---------------------------------------------------------------------------
// Twilio SMS adapter — env-gated, fetch-based (no SDK dependency).
//
// IMPORTANT: A2P 10DLC PREREQUISITE
// ---------------------------------------------------------------------------
// Sending SMS to US numbers requires A2P 10DLC registration: brand
// verification, campaign approval, and trust-score buildup. The full
// process takes 1–4 weeks. Until that's done, Twilio will silently filter
// or block your messages — sometimes after charging you for them.
//
// To prevent accidental enablement, this adapter requires BOTH:
//   1. All three Twilio env vars set (ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER)
//   2. The explicit flag SMS_ENABLED="true"
//
// Either alone is not enough. Setting only Twilio creds is treated as
// "still in setup" — the composer stays hidden, sends are rejected.
//
// When you're A2P-approved and ready to flip it on:
//   SMS_ENABLED=true
// in production env vars. Keep it unset locally and in preview.
// ---------------------------------------------------------------------------

export type SmsResult =
  | { ok: true; sid: string }
  | { ok: false; error: string };

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER &&
      process.env.SMS_ENABLED === "true",
  );
}

// E.164 normalization: accept `(555) 123-4567`, `+1 555-123-4567`, etc.
// Returns null for anything that can't reasonably be coerced.
export function normalizeE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\+\d{6,15}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  return null;
}

export async function sendSms({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<SmsResult> {
  if (!isSmsConfigured()) {
    return {
      ok: false,
      error:
        "SMS is not enabled. Requires A2P 10DLC approval + SMS_ENABLED=true.",
    };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;

  const normalizedTo = normalizeE164(to);
  if (!normalizedTo) {
    return { ok: false, error: "Invalid recipient phone number." };
  }
  if (!body.trim()) {
    return { ok: false, error: "Message body cannot be empty." };
  }
  if (body.length > 1600) {
    return { ok: false, error: "Message exceeds Twilio's 1600 char cap." };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams({ To: normalizedTo, From: from, Body: body });

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = (await r.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
    };
    if (!r.ok) {
      return {
        ok: false,
        error: data.message ?? `Twilio responded ${r.status}`,
      };
    }
    return { ok: true, sid: data.sid ?? "" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "SMS send failed",
    };
  }
}
