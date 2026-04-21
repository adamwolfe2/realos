import { NextRequest, NextResponse } from "next/server";
import { captureWithContext } from "@/lib/sentry";
import { isStripeConfigured, parseWebhookEvent } from "@/lib/stripe/config";
import { WebhookSignatureError } from "@/lib/stripe/errors";
import { webhookLimiter, checkRateLimit, getIp, rateLimited } from "@/lib/rate-limit";

// DECISION: Sprint 05 rebuilds the Stripe webhook handler against the
// real-estate billing model (subscription retainer + one-time build fee +
// ad spend markup). The distribution-era handler (200+ lines of Order,
// Invoice, Payment, Quote, Shipment plumbing) was stripped because those
// Prisma models no longer exist.
//
// For now this endpoint acknowledges Stripe but does not act on events.
// Signature verification is preserved so we can flip modules on as they land.
// TODO(Sprint 05): handle subscription.created/updated/deleted and
// invoice.paid/payment_failed for retainer billing.
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(webhookLimiter, `wh-stripe:${ip}`);
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60);
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ received: true });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    const event = await parseWebhookEvent(body, signature);
    // Accept + log for observability. Domain logic lands in Sprint 05.
    return NextResponse.json({ received: true, type: event.type });
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    captureWithContext(err, { route: "api/webhooks/stripe" });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
