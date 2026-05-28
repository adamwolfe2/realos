import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { parseWebhookEvent } from "@/lib/stripe/config";
import {
  handleMarketplaceCheckoutCompleted,
  handleMarketplaceCheckoutExpired,
  handleMarketplaceChargeRefunded,
} from "@/lib/marketplace/webhook-handlers";
import { captureWithContext } from "@/lib/sentry";

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe/marketplace
//
// Optional dedicated webhook endpoint for marketplace events. If you
// register a separate Stripe webhook endpoint for marketplace purchases
// (with its own signing secret), point it at this URL. Otherwise the
// existing /api/webhooks/stripe handler already routes marketplace
// events through the same shared lib, so this is here for the deploy-
// flexibility of teams that want event separation.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await parseWebhookEvent(rawBody, sig);
  } catch (err) {
    console.error("marketplace webhook — bad signature", err);
    captureWithContext(err, {
      route: "api/webhooks/stripe/marketplace",
      webhook: "stripe",
      stage: "signature_verification",
    });
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleMarketplaceCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "checkout.session.expired":
        await handleMarketplaceCheckoutExpired(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "charge.refunded":
        await handleMarketplaceChargeRefunded(
          event.data.object as Stripe.Charge,
        );
        break;
      // Other event types are ignored — duplicate webhook deliveries are
      // safe because each handler is idempotent.
    }
  } catch (err) {
    console.error("marketplace webhook — handler failed", event.type, err);
    captureWithContext(err, {
      route: "api/webhooks/stripe/marketplace",
      webhook: "stripe",
      eventId: event.id,
      eventType: event.type,
    });
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
