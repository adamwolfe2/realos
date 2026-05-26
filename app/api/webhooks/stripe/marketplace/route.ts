import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { parseWebhookEvent } from "@/lib/stripe/config";
import {
  MarketplaceLeadStatus,
  MarketplacePurchaseStatus,
} from "@prisma/client";
import { sendLeadDeliveryEmail } from "@/lib/marketplace/emails";

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe/marketplace
//
// Stripe webhook handler for marketplace purchases. Handles:
//   - checkout.session.completed       → flip purchase to PAID, lead to SOLD,
//                                        send PII email to buyer
//   - checkout.session.expired         → flip purchase to FAILED, return
//                                        lead to AVAILABLE
//   - charge.refunded                  → flip purchase to REFUNDED
//
// Auth: Stripe signature header verified by parseWebhookEvent.
//
// Idempotency: all mutations are gated on the current purchase status so
// duplicate webhook deliveries are safe.
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
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      }
      case "checkout.session.expired": {
        await handleCheckoutExpired(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      }
      case "charge.refunded": {
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      }
      // Other events are ignored — Stripe will retry on a non-200 response,
      // so we always 200 unless we hit a real error.
    }
  } catch (err) {
    console.error("marketplace webhook — handler failed", event.type, err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Find the purchase by checkout session id (set when we created the session).
  const purchase = await prisma.marketplacePurchase.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    include: { lead: true, buyer: true },
  });
  if (!purchase) {
    console.warn(
      "marketplace webhook — purchase not found for session",
      session.id,
    );
    return;
  }
  // Idempotency: skip if already paid.
  if (purchase.status === MarketplacePurchaseStatus.PAID) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // Stripe Checkout doesn't surface receipt_url directly — pull it from
  // the charge if we have a payment_intent. Best-effort; missing receipt
  // doesn't block delivery.
  let receiptUrl: string | null = null;
  if (paymentIntentId) {
    try {
      const { getStripeClient } = await import("@/lib/stripe/config");
      const pi = await getStripeClient().paymentIntents.retrieve(
        paymentIntentId,
        { expand: ["latest_charge"] },
      );
      const charge = pi.latest_charge as Stripe.Charge | null;
      receiptUrl = charge?.receipt_url ?? null;
    } catch {
      // ignore
    }
  }

  // Compute seller revenue split — locked at sale time so future changes
  // to revShareBps don't retroactively affect existing purchases.
  const lead = purchase.lead;
  let sellerSplit: {
    sellerIdAtSale: string | null;
    sellerShareBps: number | null;
    sellerShareCents: number | null;
    platformShareCents: number | null;
  } = {
    sellerIdAtSale: null,
    sellerShareBps: null,
    sellerShareCents: null,
    platformShareCents: null,
  };
  if (lead.sellerId) {
    const seller = await prisma.marketplaceSeller.findUnique({
      where: { id: lead.sellerId },
      select: { id: true, revShareBps: true },
    });
    if (seller) {
      const bps = seller.revShareBps;
      const sellerShareCents = Math.floor((purchase.priceCents * bps) / 10000);
      sellerSplit = {
        sellerIdAtSale: seller.id,
        sellerShareBps: bps,
        sellerShareCents,
        platformShareCents: purchase.priceCents - sellerShareCents,
      };
    }
  } else {
    // Platform-direct lead — we keep 100%.
    sellerSplit.platformShareCents = purchase.priceCents;
  }

  // Mark the lead SOLD + the purchase PAID + credit the seller atomically.
  const txnOps = [
    prisma.marketplacePurchase.update({
      where: { id: purchase.id },
      data: {
        status: MarketplacePurchaseStatus.PAID,
        stripePaymentIntentId: paymentIntentId,
        receiptUrl,
        piiDeliveredAt: new Date(),
        sellerIdAtSale: sellerSplit.sellerIdAtSale,
        sellerShareBps: sellerSplit.sellerShareBps,
        sellerShareCents: sellerSplit.sellerShareCents,
        platformShareCents: sellerSplit.platformShareCents,
      },
    }),
    prisma.marketplaceLead.update({
      where: { id: purchase.leadId },
      data: {
        status: MarketplaceLeadStatus.SOLD,
        soldToBuyerId: purchase.buyerId,
        soldAt: new Date(),
      },
    }),
  ];
  if (sellerSplit.sellerIdAtSale && sellerSplit.sellerShareCents) {
    txnOps.push(
      prisma.marketplaceSeller.update({
        where: { id: sellerSplit.sellerIdAtSale },
        data: {
          accruedCents: { increment: sellerSplit.sellerShareCents },
          unpaidOwedCents: { increment: sellerSplit.sellerShareCents },
          totalLeadsSold: { increment: 1 },
        },
      }) as never,
    );
  }
  await prisma.$transaction(txnOps);

  // Send the buyer their PII email. Failure here doesn't unwind the sale —
  // the buyer can always view the lead on /marketplace/buyer.
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  const result = await sendLeadDeliveryEmail({
    to: purchase.buyer.email,
    buyerName: purchase.buyer.fullName,
    leadId: lead.id,
    fullName: fullName || "Unknown",
    email: lead.email,
    phone: lead.phone,
    market: lead.market,
    propertyType: lead.propertyType,
    intentScore: lead.intentScore,
    signal: lead.signal,
    budgetLabel: lead.budgetLabel,
    timeline: lead.timeline,
    pricePaidCents: purchase.priceCents,
    receiptUrl,
  });
  if (result.ok) {
    await prisma.marketplacePurchase.update({
      where: { id: purchase.id },
      data: { receiptSentAt: new Date() },
    });
  } else {
    console.error("marketplace — delivery email failed", result.error);
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const purchase = await prisma.marketplacePurchase.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (!purchase) return;
  if (purchase.status !== MarketplacePurchaseStatus.PENDING) return;

  await prisma.$transaction([
    prisma.marketplacePurchase.update({
      where: { id: purchase.id },
      data: { status: MarketplacePurchaseStatus.FAILED },
    }),
    // Only un-reserve if the lead is still RESERVED (didn't get sold to
    // another buyer in the meantime).
    prisma.marketplaceLead.updateMany({
      where: {
        id: purchase.leadId,
        status: MarketplaceLeadStatus.RESERVED,
      },
      data: { status: MarketplaceLeadStatus.AVAILABLE },
    }),
  ]);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;
  const purchase = await prisma.marketplacePurchase.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!purchase) return;
  if (purchase.status === MarketplacePurchaseStatus.REFUNDED) return;

  await prisma.marketplacePurchase.update({
    where: { id: purchase.id },
    data: {
      status: MarketplacePurchaseStatus.REFUNDED,
      refundedAt: new Date(),
      refundReason: charge.refunds?.data?.[0]?.reason ?? null,
    },
  });
  // Note: we leave the lead in SOLD state — refunds are about money,
  // not re-listing. Admin can manually retire if needed.
}
