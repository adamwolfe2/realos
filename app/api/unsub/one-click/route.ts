import { NextRequest, NextResponse } from "next/server";
import {
  isEmailSuppressed,
  suppressEmail,
  verifyEmailUnsubToken,
} from "@/lib/email/suppression";

// ---------------------------------------------------------------------------
// /api/unsub/one-click — RFC 8058 one-click unsubscribe endpoint.
//
// Listed in the `List-Unsubscribe` header of every broadcast email we
// send. Gmail / Yahoo / Apple Mail POST to this URL when the recipient
// clicks the inbox-level "Unsubscribe" button. Spec requires:
//
//   - Accept POST with no auth other than the signed token.
//   - Honor the request idempotently — multiple unsubscribes for the
//     same email are fine.
//   - Respond 200 OK with empty body. Anything else (302 redirect,
//     403, JSON) confuses the spec-compliant clients.
//
// We also accept GET so the same URL works as a fallback when a
// recipient pastes it into a browser. GET returns a tiny HTML page
// with a confirmation message.
//
// CORS: must allow POST from any origin. Mail clients dispatch from
// arbitrary IPs.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function processUnsubscribe(
  email: string | null,
  token: string | null,
): Promise<{ ok: boolean; status: number; body: string }> {
  if (!email || !token) {
    return { ok: false, status: 400, body: "Missing email or token" };
  }
  const lowered = email.toLowerCase().trim();
  if (!verifyEmailUnsubToken(lowered, token)) {
    return { ok: false, status: 403, body: "Invalid token" };
  }

  // Idempotent — already-suppressed addresses just get a no-op 200.
  if (await isEmailSuppressed(lowered)) {
    return { ok: true, status: 200, body: "" };
  }

  await suppressEmail({
    email: lowered,
    reason: "one-click",
    category: "broadcast",
  });
  return { ok: true, status: 200, body: "" };
}

export async function POST(req: NextRequest) {
  // RFC 8058 says the body is `List-Unsubscribe=One-Click` form-encoded.
  // We don't actually need to read it — the email + token come from
  // the URL query string we generated. But pull both in case some
  // mail clients pass them in the body instead.
  let email = req.nextUrl.searchParams.get("e");
  let token = req.nextUrl.searchParams.get("t");

  if (!email || !token) {
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/x-www-form-urlencoded")) {
        const text = await req.text();
        const params = new URLSearchParams(text);
        email = email ?? params.get("e");
        token = token ?? params.get("t");
      }
    } catch {
      // ignore — fall through with whatever we have
    }
  }

  const result = await processUnsubscribe(email, token);
  return new NextResponse(result.body, {
    status: result.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET(req: NextRequest) {
  // Browser-pasted version — returns a tiny HTML page so the user
  // sees confirmation. The visible footer link in our emails points
  // at /unsub/email which is a richer page; this GET is a safety net.
  const email = req.nextUrl.searchParams.get("e");
  const token = req.nextUrl.searchParams.get("t");
  const result = await processUnsubscribe(email, token);
  const html = result.ok
    ? `<!DOCTYPE html><html><head><title>Unsubscribed</title><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#0A0A0A;}h1{font-size:24px;margin:0 0 12px;}p{font-size:14px;line-height:1.6;color:#5b5b5b;}</style></head><body><h1>You're unsubscribed</h1><p>${escapeHtml(email ?? "")} has been removed from our email list. You won't receive automated emails from us anymore.</p></body></html>`
    : `<!DOCTYPE html><html><head><title>Unsubscribe error</title><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#0A0A0A;}h1{font-size:24px;margin:0 0 12px;}p{font-size:14px;line-height:1.6;color:#5b5b5b;}</style></head><body><h1>Couldn't process the unsubscribe</h1><p>The link is invalid or expired. Reply to any email you've received from us and we'll remove you manually within one business day.</p></body></html>`;

  return new NextResponse(html, {
    status: result.ok ? 200 : 400,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
