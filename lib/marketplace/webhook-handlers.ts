import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import {
  MarketplaceLeadStatus,
  MarketplacePurchaseStatus,
} from "@prisma/client";
import { getStripeClient } from "@/lib/stripe/config";
import { sendLeadDeliveryEmail } from "@/lib/marketplace/emails";

// ---------------------------------------------------------------------------
// Marketplace Stripe webhook handlers
//
// These handlers are extracted from /api/webhooks/stripe/marketplace so the
// existing LeaseStack billing webhook at /api/webhooks/stripe can ALSO
// route marketplace events here without duplicating the logic.
//
// Each handler is idempotent (re-running on a duplicate webhook delivery
// is safe — status checks gate every mutation) and short-circuits early
// when the event isn't actually a marketplace purchase.
//
// Detection: marketplace checkout sessions are created with
// metadata.marketplaceLeadId. handleMarketplaceCheckoutCompleted (and
// _Expired) check that metadata first and return false if absent so the
// caller knows "this wasn't a marketplace event, continue your normal
// flow." charge.refunded events don't carry metadata directly so we
// look up by paymentIntentId — null result means "not a marketplace
// charge."
// ---------------------------------------------------------------------------

/**
 * Returns true if the event was a marketplace purchase and we handled it.
 * Returns false if the session has no marketplaceLeadId metadata (caller
 * should fall through to their existing handler).
 */
export async function handleMarketplaceCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  const leadId = session.metadata?.marketplaceLeadId;
  if (!leadId) return false;

  const purchase = await prisma.marketplacePurchase.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    include: { lead: true, buyer: true },
  });
  if (!purchase) {
    console.warn(
      "marketplace webhook — purchase not found for session",
      session.id,
    );
    return true;
  }
  // Idempotency: skip if already paid.
  if (purchase.status === MarketplacePurchaseStatus.PAID) return true;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // Best-effort receipt URL lookup. Missing receipt doesn't block delivery.
  let receiptUrl: string | null = null;
  if (paymentIntentId) {
    try {
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

  // Snapshot the seller revenue split at sale time.
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
    platformShareCents: purchase.priceCents,
  };
  if (lead.sellerId) {
    const seller = await prisma.marketplaceSeller.findUnique({
      where: { id: lead.sellerId },
      select: { id: true, revShareBps: true },
    });
    if (seller) {
      const bps = seller.revShareBps;
      const sellerShareCents = Math.floor(
        (purchase.priceCents * bps) / 10000,
      );
      sellerSplit = {
        sellerIdAtSale: seller.id,
        sellerShareBps: bps,
        sellerShareCents,
        platformShareCents: purchase.priceCents - sellerShareCents,
      };
    }
  }

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

  // Send the buyer their PII email. Failure doesn't unwind the sale.
  const fullName = [lead.firstName, lead.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
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
  return true;
}

export async function handleMarketplaceCheckoutExpired(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (!session.metadata?.marketplaceLeadId) return false;

  const purchase = await prisma.marketplacePurchase.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (!purchase) return true;
  if (purchase.status !== MarketplacePurchaseStatus.PENDING) return true;

  await prisma.$transaction([
    prisma.marketplacePurchase.update({
      where: { id: purchase.id },
      data: { status: MarketplacePurchaseStatus.FAILED },
    }),
    prisma.marketplaceLead.updateMany({
      where: {
        id: purchase.leadId,
        status: MarketplaceLeadStatus.RESERVED,
      },
      data: { status: MarketplaceLeadStatus.AVAILABLE },
    }),
  ]);
  return true;
}

/**
 * charge.refunded events don't carry our metadata, so we look up by
 * paymentIntentId. Returns true if we found and handled a marketplace
 * purchase, false if no marketplace purchase exists for this charge.
 */
export async function handleMarketplaceChargeRefunded(
  charge: Stripe.Charge,
): Promise<boolean> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return false;

  const purchase = await prisma.marketplacePurchase.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!purchase) return false;
  if (purchase.status === MarketplacePurchaseStatus.REFUNDED) return true;

  await prisma.marketplacePurchase.update({
    where: { id: purchase.id },
    data: {
      status: MarketplacePurchaseStatus.REFUNDED,
      refundedAt: new Date(),
      refundReason: charge.refunds?.data?.[0]?.reason ?? null,
    },
  });
  return true;
}
